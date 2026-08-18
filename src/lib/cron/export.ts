import type { CronExpression } from "./parse";

export interface Snippet {
  id: string;
  label: string;
  language: string;
  body: string;
  /** Set when the target cannot express what the schedule actually says. */
  caveat?: string;
  /** Practical notes: verification commands, version requirements. */
  notes?: string;
}

/**
 * GitHub Actions has no timezone field: `schedule.cron` is always UTC. Rather
 * than emit a shifted expression that silently breaks at each daylight saving
 * change, the original is kept and the mismatch is stated plainly.
 */
export function toGithubActions(expr: CronExpression, timeZone: string): Snippet {
  const utc = timeZone === "UTC";
  const lines = [
    "on:",
    "  schedule:",
    ...(utc ? [] : [`    # Interpreted as UTC by GitHub, not ${timeZone}.`]),
    `    - cron: "${expr.source}"`,
  ];

  return {
    id: "github-actions",
    label: "GitHub Actions",
    language: "yaml",
    body: lines.join("\n"),
    caveat: utc
      ? undefined
      : `GitHub Actions runs cron in UTC only. This expression means ${timeZone} here, so on GitHub it would fire at a different wall-clock time — and the difference changes when the clocks do.`,
  };
}

/** Kubernetes ≥ 1.27 can express the timezone, so the schedule survives intact. */
export function toKubernetes(expr: CronExpression, timeZone: string, name = "scheduled-job"): Snippet {
  const body = [
    "apiVersion: batch/v1",
    "kind: CronJob",
    "metadata:",
    `  name: ${name}`,
    "spec:",
    `  schedule: "${expr.source}"`,
    `  timeZone: "${timeZone}"`,
    "  concurrencyPolicy: Forbid",
    "  jobTemplate:",
    "    spec:",
    "      template:",
    "        spec:",
    "          restartPolicy: OnFailure",
    "          containers:",
    `            - name: ${name}`,
    "              image: alpine:3",
    '              command: ["sh", "-c", "echo replace me"]',
  ].join("\n");

  return {
    id: "kubernetes",
    label: "Kubernetes CronJob",
    language: "yaml",
    body,
    caveat:
      "The timeZone field needs Kubernetes 1.27 or newer. concurrencyPolicy: Forbid is set so a slow run cannot pile up on the next one.",
  };
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function field(values: number[], min: number, max: number, pad = 2): string {
  if (values.length === max - min + 1) return "*";

  // systemd understands the same start/step shape, so keep it compact.
  if (values.length > 2 && values[0] === min) {
    const step = values[1]! - values[0]!;
    const even = values.every((value, i) => i === 0 || value - values[i - 1]! === step);
    if (even && values.at(-1)! + step > max) return `${String(min).padStart(pad, "0")}/${step}`;
  }

  return values.map((value) => String(value).padStart(pad, "0")).join(",");
}

/**
 * systemd timers, where one semantic difference genuinely matters: OnCalendar
 * ANDs the weekday and the date, while cron ORs them when both are restricted.
 * The same two fields therefore mean different things in the two systems.
 */
export function toSystemd(expr: CronExpression, timeZone: string, name = "scheduled-job"): Snippet {
  const weekdays = expr.dayOfWeek.restricted
    ? `${expr.dayOfWeek.values.map((day) => DAY_NAMES[day] ?? String(day)).join(",")} `
    : "";

  const date = `*-${field(expr.month.values, 1, 12)}-${field(expr.dayOfMonth.values, 1, 31)}`;
  const time = `${field(expr.hour.values, 0, 23)}:${field(expr.minute.values, 0, 59)}:00`;
  const onCalendar = `${weekdays}${date} ${time}`;

  const body = [
    `# ${name}.timer`,
    "[Unit]",
    `Description=${name}`,
    "",
    "[Timer]",
    `OnCalendar=${onCalendar}`,
    ...(timeZone === "UTC" ? [] : [`Timezone=${timeZone}`]),
    "Persistent=true",
    "",
    "[Install]",
    "WantedBy=timers.target",
  ].join("\n");

  const notes: string[] = [
    "Check it with: systemd-analyze calendar '" + onCalendar + "'",
  ];

  if (expr.dayOfMonth.restricted && expr.dayOfWeek.restricted) {
    notes.push(
      "This schedule sets both day fields, and the two systems disagree about that: cron fires when either matches, systemd only when both do. The translation above is not equivalent — split it into two timers to keep cron's behaviour.",
    );
  }

  if (timeZone !== "UTC") {
    notes.push("Timezone= needs systemd 251 or newer; older versions run in the system timezone.");
  }

  return { id: "systemd", label: "systemd timer", language: "ini", body, notes: notes.join(" ") };
}

export function snippetsFor(expr: CronExpression, timeZone: string): Snippet[] {
  return [toGithubActions(expr, timeZone), toKubernetes(expr, timeZone), toSystemd(expr, timeZone)];
}

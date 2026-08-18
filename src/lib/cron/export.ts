import type { CronExpression } from "./parse";

export interface Snippet {
  id: string;
  label: string;
  language: string;
  body: string;
  /** Set when the target cannot express what the schedule actually says. */
  caveat?: string;
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

export function snippetsFor(expr: CronExpression, timeZone: string): Snippet[] {
  return [toGithubActions(expr, timeZone), toKubernetes(expr, timeZone)];
}

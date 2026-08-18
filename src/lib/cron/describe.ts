import { usesBothDayFields, type CronExpression, type CronField } from "./parse";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function joinWords(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

function ordinal(value: number): string {
  const rest = value % 100;
  if (rest >= 11 && rest <= 13) return `${value}th`;
  const suffix = ["th", "st", "nd", "rd"][value % 10] ?? "th";
  return `${value}${value % 10 <= 3 ? suffix : "th"}`;
}

/** Detects evenly spaced fields (the step form) so they read as an interval. */
function stepOf(field: CronField, min: number, max: number): number | null {
  const { values } = field;
  if (values.length < 2 || values[0] !== min) return null;
  const step = values[1]! - values[0]!;
  if (step < 2) return null;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i]! - values[i - 1]! !== step) return null;
  }
  return values.at(-1)! + step > max ? step : null;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function describeTime(expr: CronExpression): string {
  const { minute, hour } = expr;
  const everyMinute = minute.values.length === 60;
  const everyHour = hour.values.length === 24;

  if (everyMinute && everyHour) return "Every minute";

  const minuteStep = stepOf(minute, 0, 59);
  if (minuteStep && everyHour) return `Every ${minuteStep} minutes`;
  if (minuteStep) {
    return `Every ${minuteStep} minutes during ${joinWords(hour.values.map((h) => `${pad(h)}:00`))}`;
  }
  if (everyMinute) {
    return `Every minute of ${joinWords(hour.values.map((h) => `${pad(h)}:00`))}`;
  }

  const hourStep = stepOf(hour, 0, 23);
  if (hourStep && minute.values.length === 1) {
    return `Every ${hourStep} hours at ${pad(minute.values[0]!)} past`;
  }
  if (everyHour && minute.values.length === 1) {
    return `Every hour at ${pad(minute.values[0]!)} past`;
  }

  const times = hour.values.flatMap((h) => minute.values.map((m) => `${pad(h)}:${pad(m)}`));
  if (times.length <= 6) return `At ${joinWords(times)}`;
  return `At ${times.length} times a day, starting ${times[0]}`;
}

function describeDays(expr: CronExpression): string {
  const { dayOfMonth, dayOfWeek } = expr;
  const parts: string[] = [];

  if (dayOfWeek.restricted) {
    const days = dayOfWeek.values;
    const isWeekdays = days.length === 5 && days.every((d) => d >= 1 && d <= 5);
    const isWeekend = days.length === 2 && days.includes(0) && days.includes(6);
    if (isWeekdays) parts.push("Monday to Friday");
    else if (isWeekend) parts.push("at the weekend");
    else parts.push(`on ${joinWords(days.map((d) => DAY_LABELS[d] ?? String(d)))}`);
  }

  if (dayOfMonth.restricted) {
    const step = stepOf(dayOfMonth, 1, 31);
    if (step) parts.push(`every ${step} days of the month`);
    else if (dayOfMonth.values.length <= 4) {
      parts.push(`on the ${joinWords(dayOfMonth.values.map(ordinal))}`);
    } else {
      parts.push(`on ${dayOfMonth.values.length} days of the month`);
    }
  }

  if (parts.length === 0) return "every day";
  return joinWords(parts);
}

function describeMonths(expr: CronExpression): string {
  if (!expr.month.restricted) return "";
  const step = stepOf(expr.month, 1, 12);
  if (step) return `, every ${step} months`;
  return `, in ${joinWords(expr.month.values.map((m) => MONTH_LABELS[m - 1] ?? String(m)))}`;
}

/** One sentence describing when the schedule fires. */
export function describeCron(expr: CronExpression): string {
  const days = describeDays(expr);
  const connector = days.startsWith("on ") || days.startsWith("at ") || days.startsWith("every ") ? " " : ", ";
  return `${describeTime(expr)}${connector}${days}${describeMonths(expr)}.`;
}

export interface FieldSummary {
  label: string;
  source: string;
  reading: string;
}

/** Per-field breakdown shown next to the expression. */
export function summariseFields(expr: CronExpression): FieldSummary[] {
  const list = (values: number[], render: (value: number) => string): string =>
    values.length > 8 ? `${values.length} values` : joinWords(values.map(render));

  return [
    {
      label: "minute",
      source: expr.minute.source,
      reading: expr.minute.values.length === 60 ? "every minute" : list(expr.minute.values, pad),
    },
    {
      label: "hour",
      source: expr.hour.source,
      reading: expr.hour.values.length === 24 ? "every hour" : list(expr.hour.values, (h) => `${pad(h)}:00`),
    },
    {
      label: "day of month",
      source: expr.dayOfMonth.source,
      reading: expr.dayOfMonth.restricted ? list(expr.dayOfMonth.values, ordinal) : "any day",
    },
    {
      label: "month",
      source: expr.month.source,
      reading: expr.month.restricted
        ? list(expr.month.values, (m) => MONTH_LABELS[m - 1] ?? String(m))
        : "every month",
    },
    {
      label: "day of week",
      source: expr.dayOfWeek.source,
      reading: expr.dayOfWeek.restricted
        ? list(expr.dayOfWeek.values, (d) => DAY_LABELS[d] ?? String(d))
        : "any weekday",
    },
  ];
}

export interface Note {
  id: string;
  tone: "warn" | "info";
  text: string;
}

/** Things that are easy to get wrong and worth saying out loud. */
export function scheduleNotes(expr: CronExpression): Note[] {
  const notes: Note[] = [];

  if (usesBothDayFields(expr)) {
    notes.push({
      id: "or-rule",
      tone: "warn",
      text:
        "Both day fields are set, so cron fires when either matches — not only when both do. This runs on every matching day of the month as well as every matching weekday.",
    });
  }

  if (expr.minute.values.length === 60 && expr.hour.values.length === 24) {
    notes.push({
      id: "every-minute",
      tone: "warn",
      text: "This fires 1,440 times a day. If the job can run longer than a minute, expect overlapping runs.",
    });
  }

  if (expr.hour.values.some((hour) => hour >= 2 && hour < 3)) {
    notes.push({
      id: "dst-hour",
      tone: "info",
      text:
        "Times between 02:00 and 03:00 do not exist on the day the clocks go forward, and happen twice when they go back. This schedule will skip that day where the hour is missing.",
    });
  }

  if (expr.dayOfMonth.values.some((day) => day > 28) && expr.dayOfMonth.restricted) {
    notes.push({
      id: "short-months",
      tone: "info",
      text: "Days after the 28th do not exist in every month, so some months will be skipped.",
    });
  }

  return notes;
}

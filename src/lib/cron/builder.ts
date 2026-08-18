import type { CronExpression } from "./parse";

/**
 * A small, deliberately incomplete model of a schedule: the shapes people
 * actually build by hand. Anything richer is still perfectly valid cron — the
 * builder simply steps aside and lets the expression speak for itself.
 */
export type Frequency = "minutes" | "hourly" | "daily" | "weekly" | "monthly";

export interface BuilderState {
  frequency: Frequency;
  /** Step for "every N minutes" and "every N hours". */
  everyN: number;
  minute: number;
  hour: number;
  /** 0 = Sunday. Used by the weekly frequency. */
  weekdays: number[];
  dayOfMonth: number;
}

export const DEFAULT_BUILDER: BuilderState = {
  frequency: "daily",
  everyN: 5,
  minute: 0,
  hour: 9,
  weekdays: [1, 2, 3, 4, 5],
  dayOfMonth: 1,
};

function list(values: number[]): string {
  return values.length === 0 ? "*" : [...values].sort((a, b) => a - b).join(",");
}

export function toExpression(state: BuilderState): string {
  const { frequency, everyN, minute, hour, weekdays, dayOfMonth } = state;
  const step = Math.max(1, Math.floor(everyN));

  switch (frequency) {
    case "minutes":
      return `${step === 1 ? "*" : `*/${step}`} * * * *`;
    case "hourly":
      return `${minute} ${step === 1 ? "*" : `*/${step}`} * * *`;
    case "daily":
      return `${minute} ${hour} * * *`;
    case "weekly":
      return `${minute} ${hour} * * ${list(weekdays)}`;
    case "monthly":
      return `${minute} ${hour} ${dayOfMonth} * *`;
  }
}

/** Evenly spaced from the field's minimum, i.e. the `*​/n` shape. */
function stepOf(values: number[], min: number, max: number): number | null {
  if (values.length < 2 || values[0] !== min) return null;
  const step = values[1]! - values[0]!;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i]! - values[i - 1]! !== step) return null;
  }
  return values.at(-1)! + step > max ? step : null;
}

/**
 * Reads an expression back into builder controls, or returns null when it says
 * more than the controls can. Returning null is the honest answer: silently
 * showing an approximation would let one edit quietly rewrite the schedule.
 */
export function fromExpression(expr: CronExpression): BuilderState | null {
  const { minute, hour, dayOfMonth, month, dayOfWeek } = expr;
  if (month.restricted) return null;

  const everyMinute = minute.values.length === 60;
  const everyHour = hour.values.length === 24;
  const minuteStep = stepOf(minute.values, 0, 59);
  const hourStep = stepOf(hour.values, 0, 23);

  // Every N minutes, all day.
  if (everyHour && !dayOfMonth.restricted && !dayOfWeek.restricted) {
    if (everyMinute) return { ...DEFAULT_BUILDER, frequency: "minutes", everyN: 1 };
    if (minuteStep) return { ...DEFAULT_BUILDER, frequency: "minutes", everyN: minuteStep };
  }

  if (minute.values.length !== 1) return null;
  const theMinute = minute.values[0]!;

  // Every N hours, at a fixed minute.
  if (!dayOfMonth.restricted && !dayOfWeek.restricted) {
    if (everyHour) {
      return { ...DEFAULT_BUILDER, frequency: "hourly", everyN: 1, minute: theMinute };
    }
    if (hourStep) {
      return { ...DEFAULT_BUILDER, frequency: "hourly", everyN: hourStep, minute: theMinute };
    }
  }

  if (hour.values.length !== 1) return null;
  const theHour = hour.values[0]!;

  if (!dayOfMonth.restricted && !dayOfWeek.restricted) {
    return { ...DEFAULT_BUILDER, frequency: "daily", minute: theMinute, hour: theHour };
  }

  if (dayOfWeek.restricted && !dayOfMonth.restricted) {
    return {
      ...DEFAULT_BUILDER,
      frequency: "weekly",
      minute: theMinute,
      hour: theHour,
      weekdays: dayOfWeek.values,
    };
  }

  if (dayOfMonth.restricted && !dayOfWeek.restricted && dayOfMonth.values.length === 1) {
    return {
      ...DEFAULT_BUILDER,
      frequency: "monthly",
      minute: theMinute,
      hour: theHour,
      dayOfMonth: dayOfMonth.values[0]!,
    };
  }

  // Both day fields restricted: that is cron's OR rule, which no single control
  // in this builder can represent without lying about it.
  return null;
}

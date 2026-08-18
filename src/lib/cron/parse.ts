/**
 * A parser for standard five-field cron expressions, following Vixie cron
 * semantics — including the day-of-month / day-of-week rule that surprises
 * people (see `dayMatches`).
 */

export type FieldName = "minute" | "hour" | "dayOfMonth" | "month" | "dayOfWeek";

export interface CronField {
  name: FieldName;
  source: string;
  values: number[];
  /** False when the field is `*` or `?`, i.e. it constrains nothing. */
  restricted: boolean;
}

export interface CronExpression {
  source: string;
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  dayOfWeek: CronField;
}

export class CronError extends Error {
  constructor(
    message: string,
    readonly field: FieldName | null = null,
  ) {
    super(message);
    this.name = "CronError";
  }
}

interface FieldSpec {
  name: FieldName;
  min: number;
  max: number;
  names?: Record<string, number>;
  label: string;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const DAY_NAMES: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

const SPECS: FieldSpec[] = [
  { name: "minute", min: 0, max: 59, label: "minute" },
  { name: "hour", min: 0, max: 23, label: "hour" },
  { name: "dayOfMonth", min: 1, max: 31, label: "day of month" },
  { name: "month", min: 1, max: 12, names: MONTH_NAMES, label: "month" },
  { name: "dayOfWeek", min: 0, max: 6, names: DAY_NAMES, label: "day of week" },
];

export const MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

function parseValue(token: string, spec: FieldSpec): number {
  const named = spec.names?.[token.toLowerCase()];
  if (named !== undefined) return named;

  if (!/^\d+$/.test(token)) {
    throw new CronError(`“${token}” is not a valid ${spec.label}`, spec.name);
  }

  let value = Number(token);
  // Both 0 and 7 mean Sunday in every cron implementation worth matching.
  if (spec.name === "dayOfWeek" && value === 7) value = 0;

  if (value < spec.min || value > spec.max) {
    throw new CronError(
      `${spec.label} must be between ${spec.min} and ${spec.max}, got ${token}`,
      spec.name,
    );
  }
  return value;
}

function parseField(source: string, spec: FieldSpec): CronField {
  const restricted = source !== "*" && source !== "?";
  const values = new Set<number>();

  for (const part of source.split(",")) {
    if (part === "") throw new CronError(`Empty entry in the ${spec.label} field`, spec.name);

    const [rangePart, stepPart, ...extra] = part.split("/");
    if (extra.length > 0 || rangePart === undefined) {
      throw new CronError(`“${part}” has too many slashes`, spec.name);
    }

    let step = 1;
    if (stepPart !== undefined) {
      if (!/^\d+$/.test(stepPart) || Number(stepPart) === 0) {
        throw new CronError(`Step must be a positive number, got “${stepPart}”`, spec.name);
      }
      step = Number(stepPart);
    }

    let start: number;
    let end: number;

    if (rangePart === "*" || rangePart === "?") {
      start = spec.min;
      end = spec.max;
    } else if (rangePart.includes("-")) {
      const [from, to, ...rest] = rangePart.split("-");
      if (rest.length > 0 || from === undefined || to === undefined) {
        throw new CronError(`“${rangePart}” is not a valid range`, spec.name);
      }
      start = parseValue(from, spec);
      end = parseValue(to, spec);
      if (end < start) {
        throw new CronError(`Range ${rangePart} runs backwards`, spec.name);
      }
    } else {
      start = parseValue(rangePart, spec);
      end = stepPart === undefined ? start : spec.max;
    }

    for (let value = start; value <= end; value += step) values.add(value);
  }

  if (values.size === 0) throw new CronError(`The ${spec.label} field matches nothing`, spec.name);

  return {
    name: spec.name,
    source,
    values: [...values].sort((a, b) => a - b),
    restricted,
  };
}

export function parseCron(input: string): CronExpression {
  const trimmed = input.trim().toLowerCase();
  if (trimmed === "") throw new CronError("Enter a cron expression");

  const expanded = MACROS[trimmed] ?? trimmed;
  const tokens = expanded.split(/\s+/);

  if (tokens.length === 6) {
    throw new CronError(
      "This looks like a six-field expression with seconds. Standard cron has five fields — drop the leading one.",
    );
  }
  if (tokens.length !== 5) {
    throw new CronError(`Expected 5 fields, found ${tokens.length}`);
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = tokens.map((token, index) =>
    parseField(token, SPECS[index]!),
  ) as [CronField, CronField, CronField, CronField, CronField];

  return { source: input.trim(), minute, hour, dayOfMonth, month, dayOfWeek };
}

/**
 * Vixie cron's rule: when *both* day fields are restricted the day matches if
 * *either* does. `0 0 13 * FRI` therefore fires on every 13th and every Friday,
 * not only on Friday the 13th.
 */
export function dayMatches(expr: CronExpression, dayOfMonth: number, weekday: number): boolean {
  const domHit = expr.dayOfMonth.values.includes(dayOfMonth);
  const dowHit = expr.dayOfWeek.values.includes(weekday);

  if (expr.dayOfMonth.restricted && expr.dayOfWeek.restricted) return domHit || dowHit;
  if (expr.dayOfMonth.restricted) return domHit;
  if (expr.dayOfWeek.restricted) return dowHit;
  return true;
}

export function usesBothDayFields(expr: CronExpression): boolean {
  return expr.dayOfMonth.restricted && expr.dayOfWeek.restricted;
}

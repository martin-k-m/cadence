import { instantFromWallClock, zonedParts } from "@/lib/zones";
import { dayMatches, type CronExpression, type FieldName } from "./parse";

export interface Run {
  instant: Date;
  /** Local wall clock in the schedule's timezone. */
  hour: number;
  minute: number;
}

// Long enough to reach the next 29 February from any starting point, which is
// the rarest schedule an ordinary cron expression can describe.
const MAX_DAYS_SCANNED = 366 * 9;

/**
 * Upcoming fire times, computed in the schedule's own timezone. Days are walked
 * in local wall-clock terms and only converted to instants at the end, which is
 * how cron itself behaves: `0 3 * * *` means "03:00 local", whatever that is in
 * UTC on a given day.
 */
export function nextRuns(
  expr: CronExpression,
  options: { from: Date; timeZone: string; count: number },
): Run[] {
  const { from, timeZone, count } = options;
  const runs: Run[] = [];
  const start = zonedParts(timeZone, from);

  let cursor = Date.UTC(start.year, start.month - 1, start.day);

  for (let scanned = 0; scanned < MAX_DAYS_SCANNED && runs.length < count; scanned += 1) {
    const day = new Date(cursor);
    const year = day.getUTCFullYear();
    const month = day.getUTCMonth() + 1;
    const dayOfMonth = day.getUTCDate();
    const weekday = day.getUTCDay();

    if (expr.month.values.includes(month) && dayMatches(expr, dayOfMonth, weekday)) {
      for (const hour of expr.hour.values) {
        for (const minute of expr.minute.values) {
          const instant = instantFromWallClock(timeZone, { year, month, day: dayOfMonth, hour, minute });
          if (instant.getTime() <= from.getTime()) continue;

          // Where the wall clock time does not exist (spring forward), the
          // conversion lands on a different hour. Cron implementations differ
          // here; we report the skip rather than firing at a time nobody asked
          // for.
          const landed = zonedParts(timeZone, instant);
          if (landed.hour !== hour || landed.minute !== minute) continue;

          runs.push({ instant, hour, minute });
          if (runs.length >= count) break;
        }
        if (runs.length >= count) break;
      }
    }

    cursor += 86_400_000;
  }

  return runs.sort((a, b) => a.instant.getTime() - b.instant.getTime()).slice(0, count);
}

export interface Cadence {
  /** Number of fire times in a typical (non-DST) day, if the day matches. */
  perMatchingDay: number;
  /** Median gap between consecutive runs, in minutes. */
  medianGapMinutes: number | null;
  matchingDaysPerYear: number;
}

export function describeCadence(expr: CronExpression, runs: Run[]): Cadence {
  const perMatchingDay = expr.hour.values.length * expr.minute.values.length;

  const gaps: number[] = [];
  for (let i = 1; i < runs.length; i += 1) {
    gaps.push((runs[i]!.instant.getTime() - runs[i - 1]!.instant.getTime()) / 60_000);
  }
  gaps.sort((a, b) => a - b);
  const medianGapMinutes = gaps.length === 0 ? null : gaps[Math.floor(gaps.length / 2)] ?? null;

  let matchingDaysPerYear = 0;
  const probe = new Date(Date.UTC(2027, 0, 1)); // a common year, for a stable count
  for (let i = 0; i < 365; i += 1) {
    const month = probe.getUTCMonth() + 1;
    if (expr.month.values.includes(month) && dayMatches(expr, probe.getUTCDate(), probe.getUTCDay())) {
      matchingDaysPerYear += 1;
    }
    probe.setUTCDate(probe.getUTCDate() + 1);
  }

  return { perMatchingDay, medianGapMinutes, matchingDaysPerYear };
}

export function formatGap(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 60 * 24) {
    const hours = minutes / 60;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
  }
  const days = minutes / (60 * 24);
  return `${Number.isInteger(days) ? days : days.toFixed(1)} d`;
}

/** "in 4h 20m", or "in 35s" for the imminent case. */
export function relativeTime(target: Date, now: Date): string {
  const deltaMs = target.getTime() - now.getTime();
  if (deltaMs < 0) return "now";

  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return `in ${Math.max(1, Math.round(deltaMs / 1000))}s`;
  if (minutes < 60) return `in ${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) return restMinutes ? `in ${hours}h ${restMinutes}m` : `in ${hours}h`;

  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `in ${days}d ${restHours}h` : `in ${days}d`;
}

/**
 * The most recent fire time at or before `before`. Useful for answering "did it
 * run?" as well as "when will it run?".
 */
export function previousRun(
  expr: CronExpression,
  options: { before: Date; timeZone: string },
): Run | null {
  const { before, timeZone } = options;
  const start = zonedParts(timeZone, before);
  let cursor = Date.UTC(start.year, start.month - 1, start.day);

  for (let scanned = 0; scanned < MAX_DAYS_SCANNED; scanned += 1) {
    const day = new Date(cursor);
    const year = day.getUTCFullYear();
    const month = day.getUTCMonth() + 1;
    const dayOfMonth = day.getUTCDate();

    if (expr.month.values.includes(month) && dayMatches(expr, dayOfMonth, day.getUTCDay())) {
      // Walk the day's fire times backwards and take the first one that has been.
      for (const hour of [...expr.hour.values].reverse()) {
        for (const minute of [...expr.minute.values].reverse()) {
          const instant = instantFromWallClock(timeZone, { year, month, day: dayOfMonth, hour, minute });
          if (instant.getTime() > before.getTime()) continue;

          const landed = zonedParts(timeZone, instant);
          if (landed.hour !== hour || landed.minute !== minute) continue;

          return { instant, hour, minute };
        }
      }
    }

    cursor -= 86_400_000;
  }

  return null;
}

export interface Overlap {
  /** Shortest gap between consecutive runs, in minutes. */
  shortestGapMinutes: number | null;
  /** True when a run is due before the previous one could have finished. */
  overlaps: boolean;
}

/**
 * Compares the schedule against how long the job actually takes. A five-minute
 * cron running an eight-minute job is a pile-up waiting to happen, and cron
 * itself will not warn you.
 */
export function detectOverlap(runs: Run[], jobMinutes: number): Overlap {
  if (runs.length < 2 || jobMinutes <= 0) {
    return { shortestGapMinutes: null, overlaps: false };
  }

  let shortest = Infinity;
  for (let i = 1; i < runs.length; i += 1) {
    shortest = Math.min(shortest, (runs[i]!.instant.getTime() - runs[i - 1]!.instant.getTime()) / 60_000);
  }

  return { shortestGapMinutes: shortest, overlaps: shortest < jobMinutes };
}

export interface FireCheck {
  fires: boolean;
  /** Fields that did not match, in the order cron evaluates them. */
  blockedBy: FieldName[];
  /** Local wall clock the instant was judged against. */
  local: { hour: number; minute: number; weekday: number; day: number; month: number };
}

/**
 * Whether the schedule fires at a given instant, and if not, which fields stood
 * in the way. "Why did this not run?" is the question people actually arrive
 * with, and a list of next runs does not answer it.
 */
export function firesAt(
  expr: CronExpression,
  instant: Date,
  timeZone: string,
): FireCheck {
  const local = zonedParts(timeZone, instant);
  const blockedBy: FieldName[] = [];

  if (!expr.minute.values.includes(local.minute)) blockedBy.push("minute");
  if (!expr.hour.values.includes(local.hour)) blockedBy.push("hour");
  if (!expr.month.values.includes(local.month)) blockedBy.push("month");

  // The two day fields are judged together, because cron ORs them when both are
  // restricted; reporting them separately would be misleading.
  if (!dayMatches(expr, local.day, local.weekday)) {
    if (expr.dayOfMonth.restricted) blockedBy.push("dayOfMonth");
    if (expr.dayOfWeek.restricted) blockedBy.push("dayOfWeek");
  }

  return {
    fires: blockedBy.length === 0,
    blockedBy,
    local: {
      hour: local.hour,
      minute: local.minute,
      weekday: local.weekday,
      day: local.day,
      month: local.month,
    },
  };
}

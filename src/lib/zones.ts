/**
 * Timezone helpers built on `Intl` only. Every conversion goes through a real
 * instant, so daylight saving transitions are handled by the runtime's tz
 * database rather than by arithmetic we would have to maintain.
 */

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  /** 0 = Sunday. */
  weekday: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export function isValidZone(timeZone: string): boolean {
  try {
    partsFormatter(timeZone).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function zonedParts(timeZone: string, instant: Date): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((part) => part.type === type);
    return found ? Number(found.value) : 0;
  };

  const year = read("year");
  const month = read("month");
  const day = read("day");
  const hour = read("hour") % 24;
  const minute = read("minute");

  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

/** Offset of `timeZone` from UTC at `instant`, in minutes east of Greenwich. */
export function offsetMinutes(timeZone: string, instant: Date): number {
  const parts = zonedParts(timeZone, instant);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  // The formatted parts have minute resolution, so the instant must be
  // truncated to the same resolution before subtracting. Comparing against the
  // raw instant would shave a minute off the offset whenever it carries
  // seconds — the difference between "UTC+3" and "UTC+2:59".
  const truncated = Math.floor(instant.getTime() / 60_000) * 60_000;
  return Math.round((asUtc - truncated) / 60_000);
}

/**
 * Converts a wall-clock time in `timeZone` to the instant it refers to.
 * Resolved in two passes because the offset itself depends on the instant, and
 * the second pass is what makes times near a DST boundary land correctly.
 */
export function instantFromWallClock(
  timeZone: string,
  wall: { year: number; month: number; day: number; hour: number; minute: number },
): Date {
  const naive = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  const firstGuess = new Date(naive - offsetMinutes(timeZone, new Date(naive)) * 60_000);
  const corrected = new Date(naive - offsetMinutes(timeZone, firstGuess) * 60_000);
  return corrected;
}

export function formatOffset(minutes: number): string {
  if (minutes === 0) return "UTC";
  const sign = minutes > 0 ? "+" : "−";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  return `UTC${sign}${hours}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`;
}

/** "Europe/Madrid" → "Madrid", "America/Argentina/Salta" → "Salta". */
export function zoneCity(timeZone: string): string {
  const last = timeZone.split("/").at(-1) ?? timeZone;
  return last.replace(/_/g, " ");
}

export function zoneRegion(timeZone: string): string {
  return timeZone.split("/")[0]?.replace(/_/g, " ") ?? "";
}

export function localZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

const FALLBACK_ZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Berlin",
  "Europe/Warsaw",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function listZones(): string[] {
  const supported = (
    Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] }
  ).supportedValuesOf;
  if (typeof supported === "function") {
    try {
      return supported("timeZone");
    } catch {
      return FALLBACK_ZONES;
    }
  }
  return FALLBACK_ZONES;
}

export function formatClock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function weekdayName(weekday: number): string {
  return WEEKDAYS[weekday] ?? "";
}

export function isWeekend(weekday: number): boolean {
  return weekday === 0 || weekday === 6;
}

/** `YYYY-MM-DD` for the given instant as seen from `timeZone`. */
export function isoDate(timeZone: string, instant: Date): string {
  const { year, month, day } = zonedParts(timeZone, instant);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

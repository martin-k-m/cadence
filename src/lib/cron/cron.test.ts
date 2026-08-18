import { describe, expect, it } from "vitest";
import { CronError, dayMatches, parseCron } from "./parse";
import {
  describeCadence,
  detectOverlap,
  formatGap,
  nextRuns,
  previousRun,
  relativeTime,
} from "./schedule";
import { snippetsFor } from "./export";
import { describeCron, scheduleNotes, summariseFields } from "./describe";
import { zonedParts } from "@/lib/zones";

const utc = "UTC";
const newYork = "America/New_York";

describe("parseCron", () => {
  it("expands wildcards, lists, ranges and steps", () => {
    const expr = parseCron("*/15 9-17 * * 1-5");
    expect(expr.minute.values).toEqual([0, 15, 30, 45]);
    expect(expr.hour.values).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
    expect(expr.dayOfWeek.values).toEqual([1, 2, 3, 4, 5]);
    expect(expr.dayOfMonth.restricted).toBe(false);
  });

  it("accepts month and weekday names", () => {
    const expr = parseCron("0 0 1 JAN,jul MON");
    expect(expr.month.values).toEqual([1, 7]);
    expect(expr.dayOfWeek.values).toEqual([1]);
  });

  it("treats 7 and 0 as Sunday", () => {
    expect(parseCron("0 0 * * 7").dayOfWeek.values).toEqual([0]);
    expect(parseCron("0 0 * * 0,7").dayOfWeek.values).toEqual([0]);
  });

  it("expands macros", () => {
    expect(parseCron("@daily").hour.values).toEqual([0]);
    expect(parseCron("@weekly").dayOfWeek.values).toEqual([0]);
    expect(parseCron("@hourly").minute.values).toEqual([0]);
  });

  it("reads a step from a start value, not only from a wildcard", () => {
    expect(parseCron("5/20 * * * *").minute.values).toEqual([5, 25, 45]);
  });

  it("names the field that failed", () => {
    expect(() => parseCron("0 0 * * 9")).toThrowError(CronError);
    try {
      parseCron("0 25 * * *");
    } catch (error) {
      expect((error as CronError).field).toBe("hour");
      expect((error as CronError).message).toContain("between 0 and 23");
    }
  });

  it("explains a six-field expression rather than failing vaguely", () => {
    expect(() => parseCron("0 0 12 * * ?")).toThrowError(/six-field/);
  });

  it("rejects backwards ranges and zero steps", () => {
    expect(() => parseCron("0 17-9 * * *")).toThrowError(/backwards/);
    expect(() => parseCron("*/0 * * * *")).toThrowError(/positive/);
  });
});

describe("dayMatches", () => {
  it("ORs the day fields when both are restricted, as Vixie cron does", () => {
    const expr = parseCron("0 0 13 * FRI");
    expect(dayMatches(expr, 13, 3)).toBe(true); // the 13th, a Wednesday
    expect(dayMatches(expr, 20, 5)).toBe(true); // a Friday
    expect(dayMatches(expr, 20, 3)).toBe(false);
  });

  it("ANDs nothing when only one field is restricted", () => {
    const expr = parseCron("0 0 * * MON");
    expect(dayMatches(expr, 5, 1)).toBe(true);
    expect(dayMatches(expr, 5, 2)).toBe(false);
  });
});

describe("nextRuns", () => {
  const from = new Date("2026-08-18T10:17:00Z"); // a Tuesday

  it("returns the next fire times in order", () => {
    const runs = nextRuns(parseCron("0 * * * *"), { from, timeZone: utc, count: 3 });
    expect(runs.map((run) => run.instant.toISOString())).toEqual([
      "2026-08-18T11:00:00.000Z",
      "2026-08-18T12:00:00.000Z",
      "2026-08-18T13:00:00.000Z",
    ]);
  });

  it("never returns a time at or before the starting instant", () => {
    const exact = new Date("2026-08-18T11:00:00Z");
    const [first] = nextRuns(parseCron("0 * * * *"), { from: exact, timeZone: utc, count: 1 });
    expect(first?.instant.toISOString()).toBe("2026-08-18T12:00:00.000Z");
  });

  it("interprets the schedule in its own timezone", () => {
    const runs = nextRuns(parseCron("30 9 * * *"), { from, timeZone: newYork, count: 1 });
    expect(runs[0]?.instant.toISOString()).toBe("2026-08-18T13:30:00.000Z"); // 09:30 EDT
    expect(zonedParts(newYork, runs[0]!.instant)).toMatchObject({ hour: 9, minute: 30 });
  });

  it("keeps local wall-clock time across a daylight saving change", () => {
    const beforeChange = new Date("2026-10-30T12:00:00Z");
    const runs = nextRuns(parseCron("0 9 * * *"), {
      from: beforeChange,
      timeZone: newYork,
      count: 4,
    });
    // Clocks go back on 2026-11-01, so the UTC instant shifts but 09:00 does not.
    expect(runs.map((run) => zonedParts(newYork, run.instant).hour)).toEqual([9, 9, 9, 9]);
    expect(runs[0]?.instant.toISOString()).toBe("2026-10-30T13:00:00.000Z"); // EDT
    expect(runs.at(-1)?.instant.toISOString()).toBe("2026-11-02T14:00:00.000Z"); // EST
  });

  it("skips a wall-clock time that does not exist on the day clocks go forward", () => {
    // 2026-03-08 jumps from 02:00 to 03:00 in New York.
    const runs = nextRuns(parseCron("30 2 * * *"), {
      from: new Date("2026-03-06T12:00:00Z"),
      timeZone: newYork,
      count: 3,
    });
    const localDates = runs.map((run) => zonedParts(newYork, run.instant).day);
    expect(localDates).toEqual([7, 9, 10]); // the 8th is missing
    expect(runs.every((run) => zonedParts(newYork, run.instant).hour === 2)).toBe(true);
  });

  it("handles schedules that only match a few days a year", () => {
    const runs = nextRuns(parseCron("0 0 29 2 *"), {
      from: new Date("2026-01-01T00:00:00Z"),
      timeZone: utc,
      count: 2,
    });
    expect(runs.map((run) => run.instant.toISOString().slice(0, 10))).toEqual([
      "2028-02-29",
      "2032-02-29",
    ]);
  });
});

describe("describeCadence", () => {
  it("counts fire times per matching day and matching days per year", () => {
    const expr = parseCron("*/30 9-17 * * 1-5");
    const runs = nextRuns(expr, { from: new Date("2026-08-18T00:00:00Z"), timeZone: utc, count: 6 });
    const cadence = describeCadence(expr, runs);
    expect(cadence.perMatchingDay).toBe(18);
    expect(cadence.medianGapMinutes).toBe(30);
    expect(cadence.matchingDaysPerYear).toBe(261);
  });

  it("formats gaps for humans", () => {
    expect(formatGap(30)).toBe("30 min");
    expect(formatGap(120)).toBe("2 h");
    expect(formatGap(2880)).toBe("2 d");
    expect(formatGap(null)).toBe("—");
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-08-18T10:00:00Z");
  it("reads naturally at every scale", () => {
    expect(relativeTime(new Date("2026-08-18T10:00:30Z"), now)).toBe("in 30s");
    expect(relativeTime(new Date("2026-08-18T10:45:00Z"), now)).toBe("in 45m");
    expect(relativeTime(new Date("2026-08-18T14:20:00Z"), now)).toBe("in 4h 20m");
    expect(relativeTime(new Date("2026-08-21T10:00:00Z"), now)).toBe("in 3d");
  });
});

describe("describeCron", () => {
  it("turns an expression into a sentence", () => {
    expect(describeCron(parseCron("*/5 * * * *"))).toBe("Every 5 minutes every day.");
    expect(describeCron(parseCron("0 9 * * 1-5"))).toBe("At 09:00, Monday to Friday.");
    expect(describeCron(parseCron("30 3 1 * *"))).toBe("At 03:30 on the 1st.");
    expect(describeCron(parseCron("0 0 * * 0,6"))).toBe("At 00:00 at the weekend.");
    expect(describeCron(parseCron("0 12 1 1 *"))).toBe("At 12:00 on the 1st, in January.");
    expect(describeCron(parseCron("* * * * *"))).toBe("Every minute every day.");
  });
});

describe("summariseFields and scheduleNotes", () => {
  it("summarises every field", () => {
    const summary = summariseFields(parseCron("0 9 * * 1-5"));
    expect(summary).toHaveLength(5);
    expect(summary[0]).toMatchObject({ label: "minute", source: "0", reading: "00" });
    expect(summary[4]?.reading).toContain("Monday");
  });

  it("warns about the OR rule and about every-minute schedules", () => {
    expect(scheduleNotes(parseCron("0 0 13 * FRI")).some((n) => n.id === "or-rule")).toBe(true);
    expect(scheduleNotes(parseCron("* * * * *")).some((n) => n.id === "every-minute")).toBe(true);
    expect(scheduleNotes(parseCron("30 2 * * *")).some((n) => n.id === "dst-hour")).toBe(true);
    expect(scheduleNotes(parseCron("0 0 31 * *")).some((n) => n.id === "short-months")).toBe(true);
    expect(scheduleNotes(parseCron("0 9 * * 1-5"))).toHaveLength(0);
  });
});

describe("previousRun", () => {
  it("finds the most recent fire time before an instant", () => {
    const run = previousRun(parseCron("0 * * * *"), {
      before: new Date("2026-08-18T10:17:00Z"),
      timeZone: utc,
    });
    expect(run?.instant.toISOString()).toBe("2026-08-18T10:00:00.000Z");
  });

  it("reaches back into the previous matching day", () => {
    const run = previousRun(parseCron("30 9 * * 1-5"), {
      before: new Date("2026-08-16T12:00:00Z"), // a Sunday
      timeZone: utc,
    });
    expect(run?.instant.toISOString()).toBe("2026-08-14T09:30:00.000Z"); // the Friday
  });

  it("respects the schedule's timezone", () => {
    const run = previousRun(parseCron("0 9 * * *"), {
      before: new Date("2026-01-18T20:00:00Z"),
      timeZone: newYork,
    });
    expect(run?.instant.toISOString()).toBe("2026-01-18T14:00:00.000Z"); // 09:00 EST
    expect(zonedParts(newYork, run!.instant).hour).toBe(9);
  });

  it("includes an instant that falls exactly on a fire time", () => {
    const run = previousRun(parseCron("0 * * * *"), {
      before: new Date("2026-08-18T10:00:00Z"),
      timeZone: utc,
    });
    expect(run?.instant.toISOString()).toBe("2026-08-18T10:00:00.000Z");
  });
});

describe("detectOverlap", () => {
  const from = new Date("2026-08-18T00:00:00Z");
  const runsFor = (expression: string, count = 6) =>
    nextRuns(parseCron(expression), { from, timeZone: utc, count });

  it("flags a job that takes longer than the gap between runs", () => {
    const overlap = detectOverlap(runsFor("*/5 * * * *"), 8);
    expect(overlap.shortestGapMinutes).toBe(5);
    expect(overlap.overlaps).toBe(true);
  });

  it("stays quiet when the job fits", () => {
    expect(detectOverlap(runsFor("*/5 * * * *"), 3).overlaps).toBe(false);
    expect(detectOverlap(runsFor("0 3 * * *"), 90).overlaps).toBe(false);
  });

  it("uses the shortest gap, not the typical one", () => {
    // 09:00, 09:05 then nothing until tomorrow: the 5 minute gap is what matters.
    const overlap = detectOverlap(runsFor("0,5 9 * * *"), 7);
    expect(overlap.shortestGapMinutes).toBe(5);
    expect(overlap.overlaps).toBe(true);
  });

  it("needs at least two runs and a real duration", () => {
    expect(detectOverlap([], 10).overlaps).toBe(false);
    expect(detectOverlap(runsFor("*/5 * * * *"), 0).shortestGapMinutes).toBeNull();
  });
});

describe("snippetsFor", () => {
  const expr = parseCron("30 9 * * 1-5");

  it("warns that GitHub Actions cannot express a timezone", () => {
    const [github] = snippetsFor(expr, "Europe/Madrid");
    expect(github?.body).toContain('- cron: "30 9 * * 1-5"');
    expect(github?.body).toContain("Interpreted as UTC by GitHub");
    expect(github?.caveat).toContain("UTC only");
  });

  it("drops the warning when the schedule already is UTC", () => {
    const [github] = snippetsFor(expr, "UTC");
    expect(github?.caveat).toBeUndefined();
    expect(github?.body).not.toContain("Interpreted as UTC");
  });

  it("keeps the timezone for Kubernetes, which can express it", () => {
    const [, k8s] = snippetsFor(expr, "Asia/Tokyo");
    expect(k8s?.body).toContain('schedule: "30 9 * * 1-5"');
    expect(k8s?.body).toContain('timeZone: "Asia/Tokyo"');
    expect(k8s?.body).toContain("concurrencyPolicy: Forbid");
  });
});

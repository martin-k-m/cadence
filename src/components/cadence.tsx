"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExpressionField } from "@/components/expression-field";
import { RunsList } from "@/components/runs-list";
import { Breakdown } from "@/components/breakdown";
import { PresetPalette } from "@/components/preset-palette";
import { ZonePicker } from "@/components/zone-picker";
import { Panel } from "@/components/ui/panel";
import { Button, Kbd, Tabs } from "@/components/ui/controls";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { CronError, parseCron, type CronExpression } from "@/lib/cron/parse";
import {
  describeCadence,
  detectOverlap,
  firesAt,
  nextRuns,
  previousRun,
  relativeTime,
} from "@/lib/cron/schedule";
import { snippetsFor } from "@/lib/cron/export";
import { ExportPanel } from "@/components/export-panel";
import { BuilderPanel } from "@/components/builder-panel";
import { DEFAULT_BUILDER, fromExpression, toExpression, type BuilderState } from "@/lib/cron/builder";
import { describeCron, scheduleNotes, summariseFields } from "@/lib/cron/describe";
import { instantFromWallClock, isValidZone, localZone } from "@/lib/zones";

const RUN_COUNT = 24;

export function Cadence() {
  const [expression, setExpression] = useState("30 9 * * 1-5");
  const [timeZone, setTimeZone] = useState("UTC");
  const [showUtc, setShowUtc] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [jobMinutes, setJobMinutes] = useState(0);
  const [view, setView] = useState<"fields" | "build" | "export">("fields");
  // Only the user's own edits are stored; whatever the expression itself says
  // takes precedence, so there is no state to keep in sync with it.
  const [builderEdit, setBuilderEdit] = useState<BuilderState>(DEFAULT_BUILDER);

  // The viewer's timezone and clock exist only in the browser. Reading them
  // during render would make the server's markup and the client's first render
  // disagree, so they are adopted after mount on purpose.
  /* eslint-disable react-hooks/set-state-in-effect -- see the note above */
  useEffect(() => {
    const shared = new URLSearchParams(window.location.hash.slice(1));
    const sharedExpression = shared.get("e");
    const sharedZone = shared.get("tz");
    if (sharedExpression) setExpression(sharedExpression);
    setTimeZone(sharedZone && isValidZone(sharedZone) ? sharedZone : localZone());
    setNow(new Date());
    // Recomputed each minute: the countdowns stay honest, and a schedule that
    // fires while the page is open rolls forward on its own.
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const parsed = useMemo<{ expr: CronExpression | null; error: CronError | null }>(() => {
    try {
      return { expr: parseCron(expression), error: null };
    } catch (error) {
      return { expr: null, error: error instanceof CronError ? error : null };
    }
  }, [expression]);

  const runs = useMemo(() => {
    if (!parsed.expr || !now) return [];
    return nextRuns(parsed.expr, { from: now, timeZone, count: RUN_COUNT });
  }, [parsed.expr, now, timeZone]);

  const cadence = useMemo(
    () => (parsed.expr ? describeCadence(parsed.expr, runs) : null),
    [parsed.expr, runs],
  );

  // The address bar carries the expression, so a schedule can be sent to a
  // colleague as a link rather than pasted into a chat and re-typed.
  useEffect(() => {
    if (!now) return;
    const params = new URLSearchParams({ e: expression, tz: timeZone });
    window.history.replaceState(null, "", `#${params.toString()}`);
  }, [expression, timeZone, now]);

  const previous = useMemo(
    () => (parsed.expr && now ? previousRun(parsed.expr, { before: now, timeZone }) : null),
    [parsed.expr, now, timeZone],
  );

  const overlap = useMemo(() => detectOverlap(runs, jobMinutes), [runs, jobMinutes]);

  const snippets = useMemo(
    () => (parsed.expr ? snippetsFor(parsed.expr, timeZone) : []),
    [parsed.expr, timeZone],
  );

  // The builder follows the expression whenever the expression is simple enough
  // to be represented; when it is not, the controls detach rather than lie.
  const builderFromExpression = useMemo(
    () => (parsed.expr ? fromExpression(parsed.expr) : null),
    [parsed.expr],
  );

  const builder = builderFromExpression ?? builderEdit;

  // The input gives a wall-clock string; it is judged in the schedule's own
  // timezone, which is the only reading that answers the question honestly.
  const checkFireTime = useCallback(
    (localDateTime: string) => {
      if (!parsed.expr) return null;
      const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localDateTime);
      if (!match) return null;
      const [, year, month, day, hour, minute] = match.map(Number) as number[];
      const instant = instantFromWallClock(timeZone, {
        year: year!,
        month: month!,
        day: day!,
        hour: hour!,
        minute: minute!,
      });
      return firesAt(parsed.expr, instant, timeZone);
    },
    [parsed.expr, timeZone],
  );

  const fields = useMemo(() => (parsed.expr ? summariseFields(parsed.expr) : []), [parsed.expr]);
  const notes = useMemo(() => (parsed.expr ? scheduleNotes(parsed.expr) : []), [parsed.expr]);
  const description = parsed.expr ? describeCron(parsed.expr) : null;

  const copyExpression = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(expression.trim());
    } catch {
      // Clipboard access can be refused; the expression is on screen anyway.
    }
  }, [expression]);

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[1200px] flex-col gap-3 p-3 lg:h-[100dvh] lg:p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="font-mono text-sm font-medium tracking-tight text-fg">
            cadence<span className="text-accent">.</span>
          </h1>
          <p className="hidden text-xs text-subtle sm:block">
            Cron schedules, read back in English and previewed to the minute.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <Button variant="outline" onClick={() => setPaletteOpen(true)}>
            Schedules <Kbd>⌘K</Kbd>
          </Button>
          <Button variant="outline" onClick={copyExpression}>
            Copy
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[1fr_380px]">
        <div className="flex min-h-0 flex-col gap-3">
          <Panel order={0} className="shrink-0">
            <ExpressionField
              value={expression}
              onChange={setExpression}
              error={parsed.error}
              description={description}
            />
          </Panel>

          <Panel
            order={1}
            title={
              view === "fields"
                ? "What each field means"
                : view === "build"
                  ? "Build a schedule"
                  : "Use it elsewhere"
            }
            className="min-h-0 flex-1"
            actions={
              <div className="flex items-center gap-2">
                <JobDuration value={jobMinutes} onChange={setJobMinutes} />
                <Tabs
                  layoutId="cadence-view"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: "fields", label: "Fields" },
                    { value: "build", label: "Build" },
                    { value: "export", label: "Export" },
                  ]}
                />
              </div>
            }
          >
            {view === "fields" && (
              <Breakdown
                fields={fields}
                notes={notes}
                cadence={cadence}
                overlap={overlap}
                jobMinutes={jobMinutes}
                onCheck={checkFireTime}
              />
            )}
            {view === "build" && (
              <BuilderPanel
                state={builder}
                detached={builderFromExpression === null}
                onChange={(next) => {
                  setBuilderEdit(next);
                  setExpression(toExpression(next));
                }}
              />
            )}
            {view === "export" && <ExportPanel snippets={snippets} />}
          </Panel>
        </div>

        <Panel
          order={2}
          title="Next runs"
          hint={now ? `${runs.length} shown` : "reading your clock…"}
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowUtc((current) => !current)}
                aria-pressed={showUtc}
                className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider transition-colors ${
                  showUtc ? "bg-accent text-accent-fg" : "text-subtle hover:text-fg"
                }`}
              >
                utc
              </button>
              <div className="w-32">
                <ZonePicker value={timeZone} onChange={setTimeZone} label="Schedule timezone" />
              </div>
            </div>
          }
          className="min-h-0"
        >
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1">
              {now && <RunsList runs={runs} timeZone={timeZone} now={now} showUtc={showUtc} />}
            </div>
            {now && (
              <p className="shrink-0 border-t border-line px-4 py-1.5 text-[11px] text-subtle">
                {previous
                  ? `Last fired ${relativeTime(now, previous.instant).replace("in ", "")} ago`
                  : "Has never fired within the scanned window"}
              </p>
            )}
          </div>
        </Panel>
      </div>

      <PresetPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onPick={(preset) => setExpression(preset.expression)}
      />
    </div>
  );
}

function JobDuration({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <label className="flex items-center gap-1 text-[11px] text-subtle">
      job takes
      <input
        type="number"
        min={0}
        value={value || ""}
        placeholder="0"
        onChange={(event) => {
          const next = Number(event.target.value);
          onChange(Number.isFinite(next) && next > 0 ? next : 0);
        }}
        aria-label="How long the job takes, in minutes"
        className="tabular w-11 rounded border border-line px-1 py-0.5 text-center outline-none focus:border-line-strong"
      />
      min
    </label>
  );
}

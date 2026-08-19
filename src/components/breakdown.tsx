"use client";

import { motion, useReducedMotion } from "motion/react";
import { entranceProps } from "@/components/ui/motion";
import type { FieldSummary, Note } from "@/lib/cron/describe";
import { useState } from "react";
import type { Cadence, FireCheck, Overlap } from "@/lib/cron/schedule";
import { formatGap } from "@/lib/cron/schedule";

interface BreakdownProps {
  fields: FieldSummary[];
  notes: Note[];
  cadence: Cadence | null;
  overlap: Overlap;
  /** How long the job is expected to take, in minutes; 0 when unknown. */
  jobMinutes: number;
  /** Answers "would it have fired then?" for an instant the reader picks. */
  onCheck: (localDateTime: string) => FireCheck | null;
}

export function Breakdown({ fields, notes, cadence, overlap, jobMinutes, onCheck }: BreakdownProps) {
  const reduce = useReducedMotion();

  return (
    <div className="h-full overflow-auto" tabIndex={0} aria-label="Field breakdown">
      <table className="w-full">
        <tbody>
          {fields.map((field, index) => (
            <motion.tr
              key={field.label}
              {...entranceProps(reduce, { index, distance: 0, duration: 0.2, step: 0.03 })}
              className="border-b border-line"
            >
              <td className="w-24 px-4 py-2 text-[11px] uppercase tracking-wider text-subtle">
                {field.label}
              </td>
              <td className="w-16 py-2 font-mono text-[13px] text-accent">{field.source}</td>
              <td className="px-4 py-2 text-[13px] text-muted">{field.reading}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>

      {cadence && (
        <dl className="grid grid-cols-3 gap-px border-b border-line bg-line">
          <Stat label="per active day" value={cadence.perMatchingDay.toLocaleString()} />
          <Stat label="typical gap" value={formatGap(cadence.medianGapMinutes)} />
          <Stat label="active days a year" value={cadence.matchingDaysPerYear.toLocaleString()} />
        </dl>
      )}

      <FireChecker onCheck={onCheck} />

      {overlap.overlaps && overlap.shortestGapMinutes !== null && (
        <motion.p
          {...entranceProps(reduce, { distance: 6 })}
          className="m-3 rounded-lg border border-err/40 bg-err/[0.07] p-3 text-xs text-muted"
        >
          Runs are {formatGap(overlap.shortestGapMinutes)} apart, but the job takes {jobMinutes} min.
          A run will start before the one before it has finished — cron will not stop it, so the job
          needs its own lock, or a schedule with more room.
        </motion.p>
      )}

      {notes.length > 0 && (
        <ul className="space-y-2 p-3">
          {notes.map((note, index) => (
            <motion.li
              key={note.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.05 }}
              className={`rounded-lg border p-3 text-xs ${
                note.tone === "warn"
                  ? "border-warn/40 bg-warn/[0.07] text-muted"
                  : "border-line bg-raised text-muted"
              }`}
            >
              {note.text}
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

const FIELD_LABEL: Record<string, string> = {
  minute: "minute",
  hour: "hour",
  dayOfMonth: "day of month",
  month: "month",
  dayOfWeek: "day of week",
};

/**
 * "Why did it not run at 09:31?" is the question people arrive with, and a list
 * of future runs does not answer it.
 */
function FireChecker({ onCheck }: { onCheck: (localDateTime: string) => FireCheck | null }) {
  const [value, setValue] = useState("");
  const result = value ? onCheck(value) : null;

  return (
    <div className="border-b border-line px-4 py-3">
      <label className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-subtle">
        does it fire at
        <input
          type="datetime-local"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label="An instant to test against the schedule"
          className="tabular rounded border border-line px-2 py-1 text-[13px] normal-case tracking-normal text-fg outline-none focus:border-line-strong"
        />
        <span className="normal-case tracking-normal">in the schedule&rsquo;s timezone</span>
      </label>

      {result && (
        <p className={`mt-2 text-xs ${result.fires ? "text-ok" : "text-muted"}`}>
          {result.fires ? (
            "Yes — every field matches that moment."
          ) : (
            <>
              No. Blocked by{" "}
              {result.blockedBy.map((field, index) => (
                <span key={field}>
                  {index > 0 && (index === result.blockedBy.length - 1 ? " and " : ", ")}
                  <span className="text-err">{FIELD_LABEL[field] ?? field}</span>
                </span>
              ))}
              .
            </>
          )}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-3 py-2.5">
      <dt className="text-[10px] uppercase tracking-wider text-subtle">{label}</dt>
      <dd className="tabular mt-0.5 text-lg text-fg">{value}</dd>
    </div>
  );
}

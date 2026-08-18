"use client";

import { motion } from "motion/react";
import type { FieldSummary, Note } from "@/lib/cron/describe";
import type { Cadence, Overlap } from "@/lib/cron/schedule";
import { formatGap } from "@/lib/cron/schedule";

interface BreakdownProps {
  fields: FieldSummary[];
  notes: Note[];
  cadence: Cadence | null;
  overlap: Overlap;
  /** How long the job is expected to take, in minutes; 0 when unknown. */
  jobMinutes: number;
}

export function Breakdown({ fields, notes, cadence, overlap, jobMinutes }: BreakdownProps) {
  return (
    <div className="h-full overflow-auto">
      <table className="w-full">
        <tbody>
          {fields.map((field, index) => (
            <motion.tr
              key={field.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: index * 0.03 }}
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

      {overlap.overlaps && overlap.shortestGapMinutes !== null && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-3 py-2.5">
      <dt className="text-[10px] uppercase tracking-wider text-subtle">{label}</dt>
      <dd className="tabular mt-0.5 text-lg text-fg">{value}</dd>
    </div>
  );
}

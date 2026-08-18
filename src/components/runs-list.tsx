"use client";

import { motion } from "motion/react";
import type { Run } from "@/lib/cron/schedule";
import { relativeTime } from "@/lib/cron/schedule";
import { EmptyState } from "@/components/ui/controls";
import { weekdayName, zonedParts } from "@/lib/zones";

interface RunsListProps {
  runs: Run[];
  timeZone: string;
  now: Date;
  showUtc: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function RunsList({ runs, timeZone, now, showUtc }: RunsListProps) {
  if (runs.length === 0) {
    return (
      <EmptyState
        title="No upcoming runs"
        hint="This expression matches no date within the next nine years."
      />
    );
  }

  let previousDay = "";

  return (
    <ol className="h-full overflow-auto">
      {runs.map((run, index) => {
        const parts = zonedParts(timeZone, run.instant);
        const dayKey = `${parts.year}-${parts.month}-${parts.day}`;
        const newDay = dayKey !== previousDay;
        previousDay = dayKey;

        return (
          <motion.li
            key={run.instant.toISOString()}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.24, delay: Math.min(index, 12) * 0.025 }}
          >
            {newDay && (
              <div className="sticky top-0 z-10 flex items-baseline gap-2 border-y border-line bg-raised px-4 py-1">
                <span className="text-[11px] font-medium text-fg">
                  {weekdayName(parts.weekday)} {parts.day} {MONTHS[parts.month - 1]}
                </span>
                <span className="text-[10px] text-subtle">{parts.year}</span>
              </div>
            )}

            <div className="flex items-baseline justify-between gap-3 px-4 py-2">
              <span className="tabular font-mono text-[15px] text-fg">
                {String(parts.hour).padStart(2, "0")}:{String(parts.minute).padStart(2, "0")}
              </span>

              <div className="flex items-baseline gap-3">
                {showUtc && (
                  <span className="tabular font-mono text-[11px] text-subtle">
                    {run.instant.toISOString().slice(11, 16)} UTC
                  </span>
                )}
                <span
                  className={`tabular text-[11px] ${index === 0 ? "text-accent" : "text-subtle"}`}
                >
                  {relativeTime(run.instant, now)}
                </span>
              </div>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

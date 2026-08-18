"use client";

import { AnimatePresence, motion } from "motion/react";
import type { CronError } from "@/lib/cron/parse";

const FIELD_LABELS = ["minute", "hour", "day of month", "month", "day of week"];

interface ExpressionFieldProps {
  value: string;
  onChange: (value: string) => void;
  error: CronError | null;
  description: string | null;
}

export function ExpressionField({ value, onChange, error, description }: ExpressionFieldProps) {
  const tokens = value.trim().split(/\s+/);

  return (
    <div className="flex flex-col">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        aria-label="Cron expression"
        aria-invalid={error !== null}
        placeholder="*/5 * * * *"
        className="w-full bg-transparent px-4 pt-4 font-mono text-2xl tracking-[0.2em] text-fg outline-none placeholder:text-subtle"
      />

      <div className="flex gap-4 px-4 pb-3 pt-2">
        {FIELD_LABELS.map((label, index) => (
          <span
            key={label}
            className={`text-[10px] uppercase tracking-wider transition-colors ${
              error?.field === toFieldName(index) ? "text-err" : "text-subtle"
            }`}
          >
            {tokens[index] === undefined ? "·" : label}
          </span>
        ))}
      </div>

      {/* Keys are required for AnimatePresence to track the outgoing line. */}
      <AnimatePresence mode="wait" initial={false}>
        {error ? (
          <motion.p
            key={`error:${error.message}`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="border-t border-line bg-err/[0.06] px-4 py-2.5 text-[13px] text-err"
          >
            {error.message}
          </motion.p>
        ) : description ? (
          <motion.p
            key={`reading:${description}`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="border-t border-line px-4 py-2.5 text-[15px] text-fg"
          >
            {description}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function toFieldName(index: number): string {
  return (
    ["minute", "hour", "dayOfMonth", "month", "dayOfWeek"][index] ?? ""
  );
}

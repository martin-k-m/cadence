"use client";

import { motion } from "motion/react";
import { toExpression, type BuilderState, type Frequency } from "@/lib/cron/builder";

const FREQUENCIES: Array<{ value: Frequency; label: string }> = [
  { value: "minutes", label: "Every N minutes" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface BuilderPanelProps {
  state: BuilderState;
  /** True when the current expression says more than these controls can. */
  detached: boolean;
  onChange: (state: BuilderState) => void;
}

export function BuilderPanel({ state, detached, onChange }: BuilderPanelProps) {
  const set = (patch: Partial<BuilderState>) => onChange({ ...state, ...patch });

  return (
    <div className="h-full overflow-auto p-4">
      {detached && (
        <p className="mb-3 rounded-lg border border-line bg-raised p-3 text-xs text-muted">
          The expression above says more than these controls can express, so they are not showing
          it. Editing anything here replaces it.
        </p>
      )}

      <fieldset className="mb-4">
        <legend className="mb-1.5 text-[10px] uppercase tracking-wider text-subtle">How often</legend>
        <div className="flex flex-wrap gap-1">
          {FREQUENCIES.map((option) => {
            const active = !detached && option.value === state.frequency;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => set({ frequency: option.value })}
                className={`relative rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                  active ? "text-accent-fg" : "border border-line text-muted hover:text-fg"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="builder-frequency"
                    transition={{ type: "spring", stiffness: 460, damping: 34 }}
                    className="absolute inset-0 rounded-md bg-accent"
                  />
                )}
                <span className="relative">{option.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-end gap-4">
        {(state.frequency === "minutes" || state.frequency === "hourly") && (
          <NumberField
            label={state.frequency === "minutes" ? "every N minutes" : "every N hours"}
            value={state.everyN}
            min={1}
            max={state.frequency === "minutes" ? 59 : 23}
            onChange={(everyN) => set({ everyN })}
          />
        )}

        {state.frequency !== "minutes" && (
          <NumberField
            label="at minute"
            value={state.minute}
            min={0}
            max={59}
            onChange={(minute) => set({ minute })}
          />
        )}

        {state.frequency !== "minutes" && state.frequency !== "hourly" && (
          <NumberField label="at hour" value={state.hour} min={0} max={23} onChange={(hour) => set({ hour })} />
        )}

        {state.frequency === "monthly" && (
          <NumberField
            label="on day"
            value={state.dayOfMonth}
            min={1}
            max={31}
            onChange={(dayOfMonth) => set({ dayOfMonth })}
          />
        )}
      </div>

      {state.frequency === "weekly" && (
        <fieldset className="mt-4">
          <legend className="mb-1.5 text-[10px] uppercase tracking-wider text-subtle">On days</legend>
          <div className="flex gap-1">
            {DAY_INITIALS.map((initial, index) => {
              const active = state.weekdays.includes(index);
              return (
                <button
                  key={index}
                  type="button"
                  aria-pressed={active}
                  title={DAY_NAMES[index]}
                  onClick={() =>
                    set({
                      weekdays: active
                        ? state.weekdays.filter((day) => day !== index)
                        : [...state.weekdays, index].sort((a, b) => a - b),
                    })
                  }
                  className={`h-7 w-7 rounded-md text-xs transition-colors ${
                    active ? "bg-accent text-accent-fg" : "bg-raised text-subtle hover:text-fg"
                  }`}
                >
                  {initial}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <p className="mt-5 border-t border-line pt-3 text-xs text-subtle">
        Produces{" "}
        <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-[12px] text-accent">
          {toExpression(state)}
        </code>
      </p>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-subtle">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
        }}
        className="tabular w-16 rounded border border-line px-2 py-1 text-center text-sm text-fg outline-none focus:border-line-strong"
      />
    </label>
  );
}

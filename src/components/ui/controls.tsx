"use client";

import { motion } from "motion/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "ghost" | "solid" | "outline";
  children: ReactNode;
};

const VARIANTS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  ghost: "text-muted hover:bg-raised hover:text-fg",
  outline: "border border-line text-muted hover:border-line-strong hover:text-fg",
  solid: "bg-accent text-accent-fg hover:opacity-90",
};

export function Button({ variant = "ghost", className = "", children, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-[10px] leading-none text-subtle">
      {children}
    </kbd>
  );
}

interface TabsProps<T extends string> {
  value: T;
  options: ReadonlyArray<{ value: T; label: string; badge?: number }>;
  onChange: (value: T) => void;
  /** Distinguishes the shared layout animation when several tab bars exist. */
  layoutId: string;
}

export function Tabs<T extends string>({ value, options, onChange, layoutId }: TabsProps<T>) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-raised p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={`relative rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              active ? "text-fg" : "text-subtle hover:text-muted"
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-md bg-surface shadow-sm"
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {option.label}
              {option.badge !== undefined && (
                <span className="tabular text-[10px] text-subtle">{option.badge}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-full flex-col items-center justify-center gap-1 px-6 py-10 text-center"
    >
      <p className="text-sm text-muted">{title}</p>
      {hint && <p className="max-w-xs text-xs text-subtle">{hint}</p>}
    </motion.div>
  );
}

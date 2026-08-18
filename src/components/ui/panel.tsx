"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useEntrance } from "@/components/ui/motion";

interface PanelProps {
  title?: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Stagger index used for the entrance animation. */
  order?: number;
  className?: string;
  bodyClassName?: string;
}

export function Panel({
  title,
  hint,
  actions,
  children,
  order = 0,
  className = "",
  bodyClassName = "",
}: PanelProps) {
  const entrance = useEntrance({ index: order, distance: 12, duration: 0.45, step: 0.06 });

  return (
    <motion.section
      {...entrance}
      className={`flex min-h-0 flex-col overflow-hidden rounded-panel border border-line bg-surface ${className}`}
    >
      {(title || actions) && (
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="flex min-w-0 items-baseline gap-2">
            {title && (
              <h2 className="whitespace-nowrap text-[13px] font-medium tracking-wide text-fg">{title}</h2>
            )}
            {hint && <p className="truncate text-xs text-subtle">{hint}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </motion.section>
  );
}

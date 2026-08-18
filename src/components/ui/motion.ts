"use client";

import { useReducedMotion } from "motion/react";

interface EntranceOptions {
  /** Stagger position; the delay is capped so long lists still feel immediate. */
  index?: number;
  axis?: "x" | "y";
  distance?: number;
  duration?: number;
  step?: number;
}

/**
 * Entrance animation props that collapse to a plain fade — and then to nothing
 * at all — when the visitor has asked for reduced motion. The CSS media query
 * cannot reach animations driven from JavaScript, so this has to be explicit.
 */
export function useEntrance({
  index = 0,
  axis = "y",
  distance = 8,
  duration = 0.28,
  step = 0.03,
}: EntranceOptions = {}) {
  const reduce = useReducedMotion();

  if (reduce) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 0.001 },
    } as const;
  }

  const offset = axis === "y" ? { y: distance } : { x: distance };
  const settled = axis === "y" ? { y: 0 } : { x: 0 };

  return {
    initial: { opacity: 0, ...offset },
    animate: { opacity: 1, ...settled },
    transition: {
      duration,
      delay: Math.min(index, 12) * step,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  };
}

/**
 * The same calculation without the hook, for lists: a hook cannot be called
 * inside a `map`, so the component reads the preference once and passes it in.
 */
export function entranceProps(
  reduce: boolean | null,
  { index = 0, axis = "y", distance = 8, duration = 0.28, step = 0.03 }: EntranceOptions = {},
) {
  if (reduce) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 0.001 },
    } as const;
  }

  const offset = axis === "y" ? { y: distance } : { x: distance };
  const settled = axis === "y" ? { y: 0 } : { x: 0 };

  return {
    initial: { opacity: 0, ...offset },
    animate: { opacity: 1, ...settled },
    transition: {
      duration,
      delay: Math.min(index, 12) * step,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  };
}

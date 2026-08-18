"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDialog } from "@/lib/hooks/use-dialog";
import { PRESETS, type Preset } from "@/lib/cron/presets";

interface PresetPaletteProps {
  open: boolean;
  onClose: () => void;
  onPick: (preset: Preset) => void;
}

export function PresetPalette({ open, onClose, onPick }: PresetPaletteProps) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useDialog(open, onClose);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return PRESETS;
    return PRESETS.filter((preset) =>
      `${preset.name} ${preset.expression} ${preset.note}`.toLowerCase().includes(needle),
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    setCursor((current) => Math.min(current, Math.max(0, results.length - 1)));
  }, [results.length]);

  const commit = (preset: Preset | undefined) => {
    if (!preset) return;
    onPick(preset);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="preset-palette"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          role="presentation"
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-sm"
        >
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal
            aria-label="Common schedules"
            className="w-full max-w-lg overflow-hidden rounded-panel border border-line bg-surface shadow-2xl"
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setCursor((c) => (c + 1) % Math.max(1, results.length));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setCursor((c) => (c - 1 + results.length) % Math.max(1, results.length));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  commit(results[cursor]);
                }
              }}
              placeholder="Search common schedules…"
              aria-label="Search schedules"
              className="w-full border-b border-line px-4 py-3.5 text-sm outline-none placeholder:text-subtle"
            />

            <ul className="max-h-[46vh] overflow-auto p-1.5">
              {results.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-subtle">Nothing matches.</li>
              )}
              {results.map((preset, index) => (
                <li key={preset.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => commit(preset)}
                    data-active={index === cursor || undefined}
                    className="w-full rounded-lg px-3 py-2.5 text-left transition-colors data-[active]:bg-raised"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-medium text-fg">{preset.name}</span>
                      <code className="tabular shrink-0 font-mono text-[12px] text-accent">
                        {preset.expression}
                      </code>
                    </div>
                    <p className="mt-0.5 text-xs text-subtle">{preset.note}</p>
                  </button>
                </li>
              ))}
            </ul>

            <footer className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11px] text-subtle">
              <span>↑↓ to move</span>
              <span>↵ to load</span>
              <span>esc to dismiss</span>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

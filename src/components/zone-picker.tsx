"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatOffset, listZones, offsetMinutes, zoneCity, zoneRegion } from "@/lib/zones";

interface ZonePickerProps {
  value: string;
  onChange: (zone: string) => void;
  label?: string;
}

/** A filterable listbox over the runtime's own IANA timezone list. */
export function ZonePicker({ value, onChange, label = "Timezone" }: ZonePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const zones = useMemo(() => listZones(), []);
  const now = useMemo(() => new Date(), []);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/\s+/g, "_");
    const filtered = needle
      ? zones.filter((zone) => zone.toLowerCase().includes(needle))
      : zones;
    return filtered.slice(0, 120);
  }, [zones, query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      cancelAnimationFrame(frame);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          setQuery("");
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className="flex w-full items-baseline gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-raised"
      >
        <span className="truncate text-[13px] text-fg">{zoneCity(value)}</span>
        <span className="tabular shrink-0 text-[11px] text-subtle">
          {formatOffset(offsetMinutes(value, now))}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="zone-popover"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 top-full z-40 mt-1 w-72 overflow-hidden rounded-lg border border-line bg-surface shadow-xl"
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
                if (event.key === "Enter" && results[0]) {
                  onChange(results[0]);
                  setOpen(false);
                }
              }}
              placeholder="Search cities or regions…"
              className="w-full border-b border-line px-3 py-2 text-[13px] outline-none placeholder:text-subtle"
            />
            <ul role="listbox" className="max-h-64 overflow-auto p-1">
              {results.map((zone) => (
                <li key={zone}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={zone === value}
                    onClick={() => {
                      onChange(zone);
                      setOpen(false);
                    }}
                    className={`flex w-full items-baseline justify-between gap-3 rounded px-2 py-1.5 text-left transition-colors hover:bg-raised ${
                      zone === value ? "text-accent" : "text-fg"
                    }`}
                  >
                    <span className="truncate text-[13px]">
                      {zoneCity(zone)}
                      <span className="ml-1.5 text-[11px] text-subtle">{zoneRegion(zone)}</span>
                    </span>
                    <span className="tabular shrink-0 text-[11px] text-subtle">
                      {formatOffset(offsetMinutes(zone, now))}
                    </span>
                  </button>
                </li>
              ))}
              {results.length === 0 && (
                <li className="px-3 py-4 text-center text-xs text-subtle">No zone matches.</li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "cadence.theme";

/** Reads the theme the inline boot script already applied, then keeps it in sync. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const applied = document.documentElement.dataset.theme;
    setTheme(applied === "light" ? "light" : "dark");
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Private browsing modes can refuse storage; the toggle still works.
      }
      return next;
    });
  }, []);

  return [theme, toggle];
}

/** Runs before paint so the first frame is already in the right theme. */
export const THEME_BOOT_SCRIPT = `(()=>{try{const s=localStorage.getItem("${STORAGE_KEY}");const m=window.matchMedia("(prefers-color-scheme: light)").matches;document.documentElement.dataset.theme=s??(m?"light":"dark")}catch{document.documentElement.dataset.theme="dark"}})()`;

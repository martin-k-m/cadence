"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "cadence.theme";

/**
 * The applied theme lives on the document element, put there by the boot script
 * before first paint. Reading it through useSyncExternalStore rather than
 * copying it into state in an effect means there is no render with the wrong
 * value, and no cascading re-render to correct it.
 */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function useTheme(): [Theme, () => void] {
  // The server has no document; dark is what the markup is rendered against.
  const theme = useSyncExternalStore(subscribe, readTheme, () => "dark" as Theme);

  const toggle = useCallback(() => {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing modes can refuse storage; the toggle still works.
    }
  }, []);

  return [theme, toggle];
}

/** Runs before paint so the first frame is already in the right theme. */
export const THEME_BOOT_SCRIPT = `(()=>{try{const s=localStorage.getItem("${STORAGE_KEY}");const m=window.matchMedia("(prefers-color-scheme: light)").matches;document.documentElement.dataset.theme=s??(m?"light":"dark")}catch{document.documentElement.dataset.theme="dark"}})()`;

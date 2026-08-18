"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { Snippet } from "@/lib/cron/export";
import { useEntrance } from "@/components/ui/motion";

export function ExportPanel({ snippets }: { snippets: Snippet[] }) {
  const [active, setActive] = useState(0);
  const snippet = snippets[active];
  const entrance = useEntrance({ distance: 4, duration: 0.2 });

  if (!snippet) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-line px-2 py-1.5">
        {snippets.map((option, index) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setActive(index)}
            aria-pressed={index === active}
            className={`relative rounded px-2 py-1 text-[11px] transition-colors ${
              index === active ? "text-fg" : "text-subtle hover:text-muted"
            }`}
          >
            {index === active && (
              <motion.span
                layoutId="export-tab"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded bg-raised"
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        ))}

        <CopyButton text={snippet.body} />
      </div>

      <motion.div key={snippet.id} {...entrance} className="min-h-0 flex-1 overflow-auto">
        <pre className="px-4 py-3 font-mono text-[12px] leading-relaxed text-muted">
          {snippet.body}
        </pre>
        {snippet.notes && (
          <p className="mx-3 mb-2 rounded-lg border border-line bg-raised p-3 text-xs text-muted">
            {snippet.notes}
          </p>
        )}
        {snippet.caveat && (
          <p className="mx-3 mb-3 rounded-lg border border-warn/40 bg-warn/[0.07] p-3 text-xs text-muted">
            {snippet.caveat}
          </p>
        )}
      </motion.div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
      className="ml-auto rounded border border-line px-2 py-1 text-[11px] text-subtle transition-colors hover:border-line-strong hover:text-fg"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

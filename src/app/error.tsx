"use client";

import { useEffect } from "react";

/**
 * A static export has no server to fall back on, so an unhandled render error
 * would otherwise leave a blank page with the cause only in the console.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-sm font-medium text-fg">Something went wrong</h1>
      <p className="text-xs text-muted">
        The page hit an error it could not recover from on its own. Nothing was sent anywhere, and
        your work is still in the address bar.
      </p>
      <pre className="max-h-40 w-full overflow-auto rounded-lg border border-line bg-surface p-3 text-left font-mono text-[11px] text-subtle">
        {error.message}
      </pre>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg transition-opacity hover:opacity-90"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.hash = "";
            window.location.reload();
          }}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:text-fg"
        >
          Start fresh
        </button>
      </div>
    </main>
  );
}

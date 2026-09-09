"use client";

import { useEffect } from "react";
import Link from "next/link";

// Error boundaries must be Client Components. `app/error.tsx` wraps
// every page and layout under `app/` (this one included) in a React
// error boundary — any *unexpected* runtime error anywhere in the tree
// (a bug our own try/catch blocks didn't anticipate, not the routine
// "couldn't reach the database" cases Dashboard/Board already handle
// themselves with their own inline retry UI) lands here instead of
// showing Next's raw dev overlay or a blank page in production.
//
// `retry` (not the older `reset`) is the current, stable prop for this
// as of this project's exact Next.js version (16.3.4) — it re-fetches
// and re-renders the failed segment, not just clears local error state.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="blueprint-grid flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-50 px-4 text-center dark:bg-zinc-950 blueprint:bg-background">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-white blueprint:font-mono blueprint:text-white">
        Something went wrong
      </h1>
      <p className="max-w-xs text-sm text-zinc-500 dark:text-white/50 blueprint:text-white/70">
        An unexpected error occurred. You can try again, or head back to your
        boards.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={retry}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 blueprint:border blueprint:border-white/40 blueprint:bg-transparent blueprint:hover:bg-white/10"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-white/10 dark:text-white/60 dark:hover:border-white/20 dark:hover:text-white blueprint:border-white/20 blueprint:text-white/70 blueprint:hover:border-white/40 blueprint:hover:text-white"
        >
          Back to your boards
        </Link>
      </div>
    </div>
  );
}

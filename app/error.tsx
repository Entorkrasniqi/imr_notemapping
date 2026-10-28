"use client";

import { useEffect } from "react";
import Link from "next/link";
import AuthShell from "@/components/ui/AuthShell";

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
    <AuthShell title="Something went wrong">
      <p className="mb-4 text-(--zt-dim)">
        An unexpected error occurred. You can try again, or head back to your boards.
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={retry} className="zt-btn zt-btn-primary h-7 flex-1">
          Try again
        </button>
        <Link href="/" className="zt-btn h-7 flex-1">
          Back to your boards
        </Link>
      </div>
    </AuthShell>
  );
}

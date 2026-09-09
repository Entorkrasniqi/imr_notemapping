import Link from "next/link";

// A root `app/not-found.tsx` automatically handles any URL that doesn't
// match a route at all (not just an explicit `notFound()` call somewhere
// deeper) — has done since Next 13.3, no extra config needed. It renders
// inside the root layout, so it gets the same fonts/theme/globals.css as
// every other page, unlike the separate (and still experimental)
// `global-not-found.js` convention, which exists for apps with multiple
// root layouts — not a concern here, so plain `not-found.tsx` is the
// right, simpler tool.
export default function NotFound() {
  return (
    <div className="blueprint-grid flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-50 px-4 text-center dark:bg-zinc-950 blueprint:bg-background">
      <p className="text-sm font-medium text-zinc-400 dark:text-white/40 blueprint:text-white/60">
        404
      </p>
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-white blueprint:font-mono blueprint:text-white">
        Page not found
      </h1>
      <p className="max-w-xs text-sm text-zinc-500 dark:text-white/50 blueprint:text-white/70">
        There&apos;s nothing at this address.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 blueprint:border blueprint:border-white/40 blueprint:bg-transparent blueprint:hover:bg-white/10"
      >
        Back to NoteMap
      </Link>
    </div>
  );
}

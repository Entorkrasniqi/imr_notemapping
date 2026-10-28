import Link from "next/link";
import AuthShell from "@/components/ui/AuthShell";

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
    <AuthShell title="Page not found">
      <p className="mb-4 text-(--zt-dim)">There&apos;s nothing at this address.</p>
      <Link href="/" className="zt-btn zt-btn-primary h-7 w-full">
        Back to NoteMap
      </Link>
    </AuthShell>
  );
}

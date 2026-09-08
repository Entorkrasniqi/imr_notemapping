import { createBrowserClient } from "@supabase/ssr";

/**
 * A Supabase client for use in the browser (client components, hooks).
 *
 * `createBrowserClient` (from `@supabase/ssr`, the current recommended
 * package for Next.js) stores the session in cookies rather than only
 * `localStorage` — the detail that matters once Phase 6 adds real
 * sign-in and server-rendered protected routes need to read the same
 * session a Server Component sees. For now (Phase 5, no server-side
 * Supabase calls yet), that mostly means "this just works the same way
 * a plain browser client would," but setting it up this way from the
 * start avoids a rewrite later.
 *
 * The URL and anon key are meant to be public — Row Level Security in
 * Postgres (see docs/database.md) is what actually decides who can read
 * or write what, not secrecy of these values.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

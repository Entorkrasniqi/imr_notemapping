import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * A Supabase client authenticated as `service_role`, which bypasses Row
 * Level Security entirely. Only ever used from the Stripe webhook route
 * (`app/api/stripe/webhook/route.ts`): Stripe calls that endpoint directly,
 * with no browser session/cookies at all, so there's no `auth.uid()` for
 * RLS to check against — and per `profiles_owner_update`'s removal
 * (see the `profiles_lock_down_writes` migration), writing `plan` is no
 * longer something any authenticated-as-a-user client can do anyway. This
 * is now the *only* path allowed to change it, other than the Supabase
 * Studio SQL editor.
 *
 * Never import this from a Server Component, a client-facing Route
 * Handler, or anywhere a request's own user could influence which row
 * gets written — it has no row-level restriction of its own.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

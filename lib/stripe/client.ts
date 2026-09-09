import Stripe from "stripe";

/**
 * Server-only Stripe client. `STRIPE_SECRET_KEY` has no `NEXT_PUBLIC_`
 * prefix, so it's never bundled into client JS — this file must only ever
 * be imported from Route Handlers or other server-side code, the same rule
 * `lib/supabase/server.ts` follows for the service role key.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * The one subscription price NoteMap sells (Pro, monthly). A single
 * constant instead of a lookup table because there's only one plan to
 * upgrade to today — see `docs/roadmap.md` Phase 9.
 */
export const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID!;

-- Phase 9 (Billing): links a `profiles` row to its Stripe customer/
-- subscription so the webhook (`app/api/stripe/webhook/route.ts`) knows
-- which row to update when Stripe sends an event, and so the "Manage
-- billing" button knows which customer to open a portal session for.
--
-- Both nullable: a free user who has never started a checkout has neither.
alter table public.profiles
  add column if not exists stripe_customer_id text unique,
  add column if not exists stripe_subscription_id text;

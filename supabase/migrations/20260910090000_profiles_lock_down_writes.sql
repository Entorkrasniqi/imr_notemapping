-- `profiles_owner_update` (Phase 5) let a signed-in user update *any*
-- column on their own `profiles` row, `plan` included — RLS's `using`/
-- `with check` only ever restrict which *rows* a policy applies to, they
-- have no concept of "except this column." That meant, until now, any
-- authenticated user could run
--   supabase.from('profiles').update({ plan: 'pro' }).eq('id', <own id>)
-- directly from the browser and grant themselves the exact "unlimited
-- boards" upgrade that's supposed to require an admin (today) or a paid
-- Stripe subscription (Phase 9) — silently defeating the free-plan limit
-- this whole trigger (`boards_free_plan_limit`) exists to enforce.
--
-- No feature in the app actually depends on writing to `profiles` from
-- the client: the one row per user is created by `handle_new_user()`,
-- which is `security definer` and so runs as its owner, not as the
-- `authenticated` role — it was never relying on this grant either.
-- Removing it doesn't break anything that exists today, and forces every
-- future `plan` change through a privileged path (the SQL Editor /
-- Management API, as used manually today, or the `service_role`-keyed
-- Stripe webhook planned for Phase 9 — both bypass RLS entirely, which
-- is exactly why they're the only things that should be able to do this).
drop policy if exists profiles_owner_update on public.profiles;

revoke insert, update, delete on public.profiles from anon, authenticated;

-- Lets Postgres itself fill in `user_id` from the request's own JWT,
-- instead of the client sending a value that has to happen to match.
--
-- The RLS `with check (auth.uid() = user_id)` policy already rejects an
-- insert where those two disagree, so this isn't a security fix — the
-- database was never at risk of accepting a mismatched value. It's a
-- robustness one: a client is not a single, serial thing (multiple tabs,
-- and in development, React StrictMode intentionally mounting a component
-- twice to test cleanup logic) and can legitimately have more than one
-- Supabase client instance active close together. If one establishes a
-- new session between another's "who am I" check and its insert, a
-- client-supplied `user_id` can go stale in that gap. A database default
-- has no such gap: it reads `auth.uid()` from the JWT of the exact
-- request that's inserting, at the moment it's inserting.
alter table public.boards
  alter column user_id set default auth.uid();

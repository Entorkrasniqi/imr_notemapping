-- The small part of Supabase the migrations and RLS tests depend on, for
-- running them against a plain PostgreSQL (see scripts/test-db.sh). Never
-- applied to a real Supabase database — it already has all of this.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text
);

-- Same definition Supabase uses: the `sub` claim of the request's JWT.
create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase grants table access to its API roles by default and relies on
-- RLS to restrict it; mirror that so the tests exercise RLS, not grants.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

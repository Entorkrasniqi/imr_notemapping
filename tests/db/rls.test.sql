-- Row Level Security tests: every way one user might reach another user's
-- data directly through the database API — not just through the app's own
-- queries, which only ever ask for the caller's own rows.
--
-- Runs as the same `authenticated`/`anon` roles PostgREST uses, with a
-- JWT `sub` claim set the way Supabase sets it. Everything happens inside
-- one transaction that's rolled back at the end, so it can run against
-- any database with the migrations applied. See docs/DEVOPS.md §4.
\set ON_ERROR_STOP on
-- Only failures are interesting; don't print every assertion's empty result.
\o /dev/null
begin;

create schema rls_test;
grant usage on schema rls_test to anon, authenticated;

-- Become a signed-in user (or, with null, the anonymous API role).
create function rls_test.act_as(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(user_id::text, ''), true);
  perform set_config('request.jwt.claims',
    case when user_id is null then '{"role":"anon"}'
         else json_build_object('sub', user_id, 'role', 'authenticated')::text end, true);
  if user_id is null then set local role anon; else set local role authenticated; end if;
end $$;

create function rls_test.expect_rows(query text, expected bigint, description text) returns void language plpgsql as $$
declare actual bigint;
begin
  execute format('select count(*) from (%s) q', query) into actual;
  if actual <> expected then
    raise exception 'FAIL: % — expected % rows, got %', description, expected, actual;
  end if;
end $$;

create function rls_test.expect_affected(statement text, expected bigint, description text) returns void language plpgsql as $$
declare actual bigint;
begin
  execute statement;
  get diagnostics actual = row_count;
  if actual <> expected then
    raise exception 'FAIL: % — expected % rows changed, got %', description, expected, actual;
  end if;
end $$;

-- 42501 = RLS or privilege violation, 23503 = foreign key, P0001 = the
-- board-limit trigger.
create function rls_test.expect_error(statement text, expected_state text, description text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_state then return; end if;
    raise exception 'FAIL: % — expected SQLSTATE %, got % (%)', description, expected_state, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL: % — the statement succeeded but must be rejected', description;
end $$;

grant execute on all functions in schema rls_test to anon, authenticated;

-- Three accounts; `handle_new_user` creates their profiles.
insert into auth.users (id, email) values
  ('00000000-0000-4000-a000-00000000000a', 'alice@rls.test'),
  ('00000000-0000-4000-a000-00000000000b', 'bob@rls.test'),
  ('00000000-0000-4000-a000-00000000000c', 'carol@rls.test');
update public.profiles set plan = 'pro' where id = '00000000-0000-4000-a000-00000000000c';

-- Alice's board: two notes and an edge between them.
select rls_test.act_as('00000000-0000-4000-a000-00000000000a');
insert into public.boards (id, name) values ('10000000-0000-4000-a000-00000000000a', 'Alice''s plans');
insert into public.nodes (id, board_id, content) values
  ('20000000-0000-4000-a000-0000000000a1', '10000000-0000-4000-a000-00000000000a', '{"type":"doc"}'),
  ('20000000-0000-4000-a000-0000000000a2', '10000000-0000-4000-a000-00000000000a', '{}');
insert into public.edges (id, board_id, source_node_id, target_node_id) values
  ('30000000-0000-4000-a000-0000000000a1', '10000000-0000-4000-a000-00000000000a',
   '20000000-0000-4000-a000-0000000000a1', '20000000-0000-4000-a000-0000000000a2');
select rls_test.expect_rows('select 1 from public.boards', 1, 'Alice sees her own board');
select rls_test.expect_rows('select 1 from public.nodes', 2, 'Alice sees her own notes');
reset role;

-- Bob, signed in, trying to reach Alice's data.
select rls_test.act_as('00000000-0000-4000-a000-00000000000b');
select rls_test.expect_rows('select 1 from public.boards', 0, 'Bob cannot list Alice''s boards');
select rls_test.expect_rows('select 1 from public.nodes', 0, 'Bob cannot read Alice''s notes');
select rls_test.expect_rows('select 1 from public.edges', 0, 'Bob cannot read Alice''s edges');
select rls_test.expect_rows($$select 1 from public.nodes where id = '20000000-0000-4000-a000-0000000000a1'$$, 0,
  'Bob cannot read one of Alice''s notes by id');
select rls_test.expect_rows('select 1 from public.profiles', 1, 'Bob sees only his own profile');

select rls_test.expect_affected($$update public.boards set name = 'pwned' where id = '10000000-0000-4000-a000-00000000000a'$$, 0,
  'Bob cannot rename Alice''s board');
select rls_test.expect_affected($$update public.nodes set content = '{}' where board_id = '10000000-0000-4000-a000-00000000000a'$$, 0,
  'Bob cannot edit Alice''s notes');
select rls_test.expect_affected($$delete from public.nodes where board_id = '10000000-0000-4000-a000-00000000000a'$$, 0,
  'Bob cannot delete Alice''s notes');
select rls_test.expect_affected($$delete from public.edges where board_id = '10000000-0000-4000-a000-00000000000a'$$, 0,
  'Bob cannot delete Alice''s edges');
select rls_test.expect_affected($$delete from public.boards where id = '10000000-0000-4000-a000-00000000000a'$$, 0,
  'Bob cannot delete Alice''s board');

select rls_test.expect_error($$insert into public.nodes (board_id) values ('10000000-0000-4000-a000-00000000000a')$$, '42501',
  'Bob cannot add a note to Alice''s board');
select rls_test.expect_error($$insert into public.boards (name, user_id) values ('x', '00000000-0000-4000-a000-00000000000a')$$, '42501',
  'Bob cannot create a board owned by Alice');

-- Bob's own board, then attempts to reach across from it.
insert into public.boards (id, name) values ('10000000-0000-4000-a000-00000000000b', 'Bob''s board');
insert into public.nodes (id, board_id) values ('20000000-0000-4000-a000-0000000000b1', '10000000-0000-4000-a000-00000000000b');
select rls_test.expect_error($$update public.boards set user_id = '00000000-0000-4000-a000-00000000000a' where id = '10000000-0000-4000-a000-00000000000b'$$, '42501',
  'Bob cannot hand his board over to Alice');
select rls_test.expect_error($$update public.nodes set board_id = '10000000-0000-4000-a000-00000000000a' where id = '20000000-0000-4000-a000-0000000000b1'$$, '42501',
  'Bob cannot move his note into Alice''s board');
select rls_test.expect_error($$insert into public.edges (board_id, source_node_id, target_node_id) values
  ('10000000-0000-4000-a000-00000000000b', '20000000-0000-4000-a000-0000000000b1', '20000000-0000-4000-a000-0000000000a1')$$, '23503',
  'Bob cannot connect his note to Alice''s note');

-- Plans only change through Stripe's webhook (service role), never directly.
select rls_test.expect_error($$update public.profiles set plan = 'pro' where id = '00000000-0000-4000-a000-00000000000b'$$, '42501',
  'Bob cannot upgrade himself to Pro');
select rls_test.expect_error($$insert into public.profiles (id, plan) values ('00000000-0000-4000-a000-0000000000ff', 'pro')$$, '42501',
  'Bob cannot create a profile row');
select rls_test.expect_error($$delete from public.profiles where id = '00000000-0000-4000-a000-00000000000b'$$, '42501',
  'Bob cannot delete his profile row');

select rls_test.expect_error($$insert into public.boards (name) values ('')$$, '23514',
  'A board name cannot be empty');

-- Free plan: three boards, and the fourth is refused.
insert into public.boards (name) values ('Bob 2'), ('Bob 3');
select rls_test.expect_error($$insert into public.boards (name) values ('Bob 4')$$, 'P0001',
  'A free account cannot create a fourth board');
reset role;

-- Carol is on Pro: no limit.
select rls_test.act_as('00000000-0000-4000-a000-00000000000c');
insert into public.boards (name) values ('C1'), ('C2'), ('C3'), ('C4');
select rls_test.expect_rows('select 1 from public.boards', 4, 'A Pro account can create more than three boards');
reset role;

-- Signed out: nothing visible, nothing writable.
select rls_test.act_as(null);
select rls_test.expect_rows('select 1 from public.boards', 0, 'Anonymous cannot list boards');
select rls_test.expect_rows('select 1 from public.nodes', 0, 'Anonymous cannot read notes');
select rls_test.expect_rows('select 1 from public.profiles', 0, 'Anonymous cannot read profiles');
select rls_test.expect_error($$insert into public.boards (name, user_id) values ('x', '00000000-0000-4000-a000-00000000000a')$$, '42501',
  'Anonymous cannot create a board for someone');
select rls_test.expect_affected($$delete from public.nodes$$, 0, 'Anonymous cannot delete notes');
reset role;

-- Deleting a board takes its notes and edges with it.
select rls_test.act_as('00000000-0000-4000-a000-00000000000a');
delete from public.boards where id = '10000000-0000-4000-a000-00000000000a';
reset role;
select rls_test.expect_rows($$select 1 from public.nodes where board_id = '10000000-0000-4000-a000-00000000000a'$$, 0,
  'Deleting a board deletes its notes');
select rls_test.expect_rows($$select 1 from public.edges where board_id = '10000000-0000-4000-a000-00000000000a'$$, 0,
  'Deleting a board deletes its edges');

\o
\echo 'RLS tests passed: cross-user reads/writes, plan changes, board limit, anonymous access, cascades.'
rollback;

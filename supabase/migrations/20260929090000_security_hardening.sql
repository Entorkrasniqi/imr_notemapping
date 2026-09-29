-- Security hardening — see docs/SECURITY.md §2 for the reasoning behind
-- each change, and tests/db/rls.test.sql for the tests that exercise them.

-- ---------------------------------------------------------------------
-- 1. An edge may only connect notes on its own board.
--
-- `edges_owner_all` checks that the caller owns the edge's *board*, but
-- nothing tied `source_node_id`/`target_node_id` to that same board: the
-- single-column foreign keys are checked without RLS, so a user could
-- write an edge in their own board pointing at another user's note ids
-- (and use the foreign-key error as a "does this id exist?" oracle).
-- Composite foreign keys make "same board" part of the schema itself.
-- ---------------------------------------------------------------------
alter table public.nodes
  add constraint nodes_board_id_id_key unique (board_id, id);

alter table public.edges
  add constraint edges_source_on_same_board
    foreign key (board_id, source_node_id) references public.nodes (board_id, id) on delete cascade not valid,
  add constraint edges_target_on_same_board
    foreign key (board_id, target_node_id) references public.nodes (board_id, id) on delete cascade not valid;

-- Checked separately so existing rows are verified too; the app has never
-- written a cross-board edge, so this is expected to pass. If it ever
-- fails, a row really is broken and needs looking at before deploying.
alter table public.edges validate constraint edges_source_on_same_board;
alter table public.edges validate constraint edges_target_on_same_board;

-- ---------------------------------------------------------------------
-- 2. The free-plan board limit can't be raced.
--
-- The trigger counted a user's boards, then allowed the insert — two
-- concurrent inserts could both count 2 and both succeed, ending at 4.
-- A transaction-scoped advisory lock per user makes the second insert
-- wait for the first to commit, then count again.
-- ---------------------------------------------------------------------
create or replace function public.enforce_free_plan_board_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_plan text;
  existing_board_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('board_limit:' || new.user_id::text, 0));

  select plan into user_plan from public.profiles where id = new.user_id;

  -- A pro user (or, defensively, a user whose profile row hasn't been
  -- created yet for some reason) isn't limited here.
  if user_plan is distinct from 'free' then
    return new;
  end if;

  select count(*) into existing_board_count
  from public.boards
  where user_id = new.user_id;

  if existing_board_count >= 3 then
    raise exception 'Free plan is limited to 3 boards'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Board names are bounded. Both clients already trim and reject empty
-- names; this stops a hand-crafted request storing an empty or
-- megabyte-long one.
-- ---------------------------------------------------------------------
alter table public.boards
  add constraint boards_name_length check (char_length(name) between 1 and 200);

-- The free-plan board limit, as documented (but deferred) in
-- docs/database.md §6: a trigger, not an RLS policy, because RLS's
-- `using`/`with check` can only evaluate the row being read or written —
-- they have no way to express "count how many rows this user already
-- has." A `before insert` trigger can run an arbitrary query first.
--
-- This is the layer that actually can't be bypassed. The dashboard UI
-- also checks the count before showing "+ Create board" as available
-- (see lib/supabase/boards.ts) purely for a fast, friendly message — a
-- user editing requests directly, or a bug in that client-side check,
-- still hits this and gets rejected.
create function public.enforce_free_plan_board_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_plan text;
  existing_board_count integer;
begin
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

create trigger boards_enforce_free_plan_limit
  before insert on public.boards
  for each row execute function public.enforce_free_plan_board_limit();

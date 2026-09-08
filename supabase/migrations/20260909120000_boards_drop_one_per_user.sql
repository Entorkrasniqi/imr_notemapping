-- Phase 5 added `unique (user_id)` on boards as an explicit, documented
-- simplification for "no dashboard yet, one implicit board per user" (see
-- the `boards_one_per_user` migration and docs/database.md §4a). Phase 7
-- is exactly the dashboard that constraint said would need it dropped —
-- real multi-board support, with its own free-plan limit taking over as
-- the actual cap (see the `boards_free_plan_limit` migration alongside
-- this one).
alter table public.boards
  drop constraint if exists boards_user_id_unique;

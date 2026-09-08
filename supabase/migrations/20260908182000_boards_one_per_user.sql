-- Phase 5 has no dashboard yet (that's Phase 7) — the app only ever shows
-- one implicit board per user, found-or-created by `getOrCreateBoard`.
-- That function does a select, then (if nothing came back) an insert —
-- two separate requests, not one atomic operation. Two concurrent calls
-- (two browser tabs opened at once, or — in development — React
-- StrictMode intentionally mounting a component twice to test cleanup
-- logic) can both see "no board yet" and both insert one.
--
-- This constraint turns that race into a clean, specific error
-- (`23505`, unique_violation) that `getOrCreateBoard` catches and
-- recovers from by re-fetching whichever board actually won — rather
-- than two real boards silently existing for one user. It's intentionally
-- a Phase 5 simplification: Phase 7 adds real multi-board support (up to
-- 3 on the free plan) and will need to drop this constraint then.
alter table public.boards
  add constraint boards_user_id_unique unique (user_id);

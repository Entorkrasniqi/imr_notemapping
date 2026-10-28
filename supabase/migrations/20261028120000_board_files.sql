-- Board files: up to ten reference documents (PDFs) per board, shown in the
-- board's left sidebar and readable beside the canvas. See docs/database.md
-- §2 for the design. Purely additive — boards, nodes and edges are untouched,
-- so nothing that reads them (including the ScriptumOS Mac app) is affected.
--
-- The file *contents* live in a private Storage bucket; this table holds the
-- list: name, size, and which board it belongs to.

-- ---------------------------------------------------------------------
-- 1. The table.
--
-- `storage_path` is generated from the ids rather than sent by the client,
-- so a row and its object can never disagree about where the file lives,
-- and the Storage policies below can tie an upload to a row that exists.
-- ---------------------------------------------------------------------
create table if not exists public.board_files (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  name text not null,
  mime_type text not null default 'application/pdf',
  size_bytes bigint not null,
  storage_path text generated always as (board_id::text || '/' || id::text || '.pdf') stored,
  created_at timestamptz not null default now(),
  constraint board_files_name_length check (char_length(name) between 1 and 200),
  constraint board_files_mime_type check (mime_type = 'application/pdf'),
  -- 20 MiB, the same cap as the bucket below.
  constraint board_files_size check (size_bytes between 1 and 20971520)
);

create index if not exists board_files_board_id_idx on public.board_files (board_id);

alter table public.board_files enable row level security;

create policy "board_files_owner_all" on public.board_files
  for all
  using (
    exists (
      select 1 from public.boards
      where boards.id = board_files.board_id
      and boards.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.boards
      where boards.id = board_files.board_id
      and boards.user_id = auth.uid()
    )
  );

-- A row can be renamed, nothing else. Without this, `update` could move a
-- file to another board of the user's (changing its generated path and
-- orphaning the stored object) or lie about its size.
revoke update on public.board_files from anon, authenticated;
grant update (name) on public.board_files to authenticated;

-- ---------------------------------------------------------------------
-- 2. At most ten files per board.
--
-- Runs with the caller's rights on purpose (no `security definer`): the
-- count is then subject to RLS, so asking to add a file to someone else's
-- board sees zero rows and falls through to the policy's plain "denied" —
-- it can't be used to learn whether another user's board is full. The
-- advisory lock makes two concurrent inserts count one after the other, as
-- in `enforce_free_plan_board_limit`.
-- ---------------------------------------------------------------------
create or replace function public.enforce_board_file_limit()
returns trigger
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('board_files:' || new.board_id::text, 0));

  if (select count(*) from public.board_files where board_id = new.board_id) >= 10 then
    raise exception 'A board can hold at most 10 files'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger board_files_limit
  before insert on public.board_files
  for each row execute function public.enforce_board_file_limit();

-- ---------------------------------------------------------------------
-- 3. The private bucket and its policies.
--
-- An upload is only accepted at a path that already has a `board_files`
-- row, so the ten-file limit and the size check above also bound what can
-- reach Storage — there is no way to fill the bucket without rows.
-- Reading is allowed to whoever can see the row (today, the board's
-- owner; sharing will extend that for free) or to the uploader. Deleting
-- is the uploader's alone, row or no row, so objects left behind when a
-- board is deleted somewhere that doesn't clean up can still be removed.
--
-- Skipped, with a notice, where Storage isn't installed (a bare Postgres).
-- On Supabase it always is.
-- ---------------------------------------------------------------------
do $storage$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage.objects does not exist: skipping the board-files bucket and policies';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('board-files', 'board-files', false, 20971520, array['application/pdf'])
  on conflict (id) do nothing;

  create policy "board_files_read" on storage.objects
    for select to authenticated
    using (
      bucket_id = 'board-files'
      and (
        owner_id = (select auth.uid())::text
        or exists (select 1 from public.board_files f where f.storage_path = objects.name)
      )
    );

  create policy "board_files_upload" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'board-files'
      and exists (select 1 from public.board_files f where f.storage_path = objects.name)
    );

  create policy "board_files_remove" on storage.objects
    for delete to authenticated
    using (
      bucket_id = 'board-files'
      and owner_id = (select auth.uid())::text
    );
end
$storage$;

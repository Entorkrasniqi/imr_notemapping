-- Board files, part 2: more than PDFs. Images, plain text and Markdown, Word,
-- PowerPoint and EPUB files, and web links, all in the same ten-per-board
-- sidebar. Builds on 20261028120000_board_files.sql (run that first); see
-- docs/database.md §6b.
--
-- Still additive for everything outside `board_files` — boards, nodes and
-- edges are untouched. Existing PDF rows keep exactly the same storage path.

-- ---------------------------------------------------------------------
-- 1. Storage policies reference `storage_path`, which is redefined below,
-- so they are dropped here and recreated in section 4. (Skipped where
-- Storage isn't installed, as in the first migration.)
-- ---------------------------------------------------------------------
do $storage$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;
  drop policy if exists "board_files_read" on storage.objects;
  drop policy if exists "board_files_upload" on storage.objects;
end
$storage$;

-- ---------------------------------------------------------------------
-- 2. Columns and constraints.
--
-- `kind` is 'file' (bytes in Storage) or 'link' (just a URL). A row must be
-- exactly one of the two shapes — checked in one constraint so a half-filled
-- row can't exist:
--   file: an allowed type, no url, 1 byte to 20 MiB
--   link: no type, an http(s) url without spaces (max 2000 chars), size 0
-- SVG is deliberately not an allowed image type: it can carry script.
-- ---------------------------------------------------------------------
alter table public.board_files
  add column if not exists kind text not null default 'file',
  add column if not exists url text;

alter table public.board_files
  drop constraint if exists board_files_mime_type,
  drop constraint if exists board_files_size;

alter table public.board_files alter column mime_type drop not null;

alter table public.board_files
  add constraint board_files_kind check (kind in ('file', 'link')),
  add constraint board_files_shape check (
    (
      kind = 'file'
      and url is null
      and mime_type in (
        'application/pdf',
        'image/png', 'image/jpeg', 'image/webp', 'image/gif',
        'text/plain', 'text/markdown',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/epub+zip'
      )
      and size_bytes between 1 and 20971520
    )
    or (
      kind = 'link'
      and mime_type is null
      and size_bytes = 0
      and url ~ '^https?://[^[:space:]]+$'
      and char_length(url) <= 2000
    )
  );

-- ---------------------------------------------------------------------
-- 3. The generated storage path now depends on the type (for the file
-- extension) and is null for a link. For a PDF it is the same
-- `<board_id>/<id>.pdf` as before, so nothing already stored moves.
-- ---------------------------------------------------------------------
alter table public.board_files drop column storage_path;
alter table public.board_files
  add column storage_path text generated always as (
    case when kind = 'file' then
      board_id::text || '/' || id::text ||
      case mime_type
        when 'application/pdf' then '.pdf'
        when 'image/png' then '.png'
        when 'image/jpeg' then '.jpg'
        when 'image/webp' then '.webp'
        when 'image/gif' then '.gif'
        when 'text/plain' then '.txt'
        when 'text/markdown' then '.md'
        when 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' then '.docx'
        when 'application/vnd.openxmlformats-officedocument.presentationml.presentation' then '.pptx'
        when 'application/epub+zip' then '.epub'
      end
    end
  ) stored;

-- ---------------------------------------------------------------------
-- 4. The bucket accepts the new types, and the two policies dropped in
-- section 1 come back, unchanged.
-- ---------------------------------------------------------------------
do $storage$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage.objects does not exist: skipping the bucket update and policies';
    return;
  end if;

  update storage.buckets
  set allowed_mime_types = array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'text/plain', 'text/markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/epub+zip'
  ]
  where id = 'board-files';

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
end
$storage$;

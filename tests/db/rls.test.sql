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

-- Board files: ten per board, owner-only, rename-only, PDFs of a sane size.
-- Alice's board (…0a) gets files; Bob's board (…0b) is the one he may use.
select rls_test.act_as('00000000-0000-4000-a000-00000000000a');
insert into public.board_files (id, board_id, name, size_bytes)
  values ('40000000-0000-4000-a000-0000000000a1', '10000000-0000-4000-a000-00000000000a', 'Thesis.pdf', 1024);
select rls_test.expect_rows($$select 1 from public.board_files where storage_path =
  '10000000-0000-4000-a000-00000000000a/40000000-0000-4000-a000-0000000000a1.pdf'$$, 1,
  'A file''s storage path is built from its board and id');
select rls_test.expect_affected($$update public.board_files set name = 'Renamed.pdf' where id = '40000000-0000-4000-a000-0000000000a1'$$, 1,
  'Alice can rename her file');
select rls_test.expect_error($$update public.board_files set size_bytes = 1 where id = '40000000-0000-4000-a000-0000000000a1'$$, '42501',
  'A file''s size cannot be edited');
select rls_test.expect_error($$update public.board_files set board_id = '10000000-0000-4000-a000-00000000000b' where id = '40000000-0000-4000-a000-0000000000a1'$$, '42501',
  'A file cannot be moved to another board');
select rls_test.expect_error($$insert into public.board_files (board_id, name, size_bytes) values ('10000000-0000-4000-a000-00000000000a', '', 10)$$, '23514',
  'A file name cannot be empty');
select rls_test.expect_error($$insert into public.board_files (board_id, name, size_bytes) values ('10000000-0000-4000-a000-00000000000a', 'x.pdf', 0)$$, '23514',
  'A file cannot be empty');
select rls_test.expect_error($$insert into public.board_files (board_id, name, size_bytes) values ('10000000-0000-4000-a000-00000000000a', 'x.pdf', 20971521)$$, '23514',
  'A file cannot exceed 20 MiB');
select rls_test.expect_error($$insert into public.board_files (board_id, name, size_bytes, mime_type) values ('10000000-0000-4000-a000-00000000000a', 'x.html', 10, 'text/html')$$, '23514',
  'Only PDFs are accepted');
-- More types: an image and a web link share the same ten slots.
insert into public.board_files (id, board_id, name, size_bytes, mime_type)
  values ('40000000-0000-4000-a000-0000000000a2', '10000000-0000-4000-a000-00000000000a', 'Diagram.png', 2048, 'image/png');
select rls_test.expect_rows($$select 1 from public.board_files where storage_path =
  '10000000-0000-4000-a000-00000000000a/40000000-0000-4000-a000-0000000000a2.png'$$, 1,
  'An image''s storage path carries its own extension');
insert into public.board_files (id, board_id, name, size_bytes, mime_type, kind, url)
  values ('40000000-0000-4000-a000-0000000000a3', '10000000-0000-4000-a000-00000000000a', 'A paper', 0, null, 'link', 'https://example.com/paper?id=1');
select rls_test.expect_rows($$select 1 from public.board_files where kind = 'link' and storage_path is null and mime_type is null$$, 1,
  'A link has no stored file');
select rls_test.expect_error($$insert into public.board_files (board_id, name, size_bytes, mime_type) values ('10000000-0000-4000-a000-00000000000a', 'x.svg', 10, 'image/svg+xml')$$, '23514',
  'SVG is refused (it can carry script)');
select rls_test.expect_error($$insert into public.board_files (board_id, name, size_bytes, mime_type) values ('10000000-0000-4000-a000-00000000000a', 'x.doc', 10, 'application/msword')$$, '23514',
  'Legacy Word files are refused');
select rls_test.expect_error($$insert into public.board_files (board_id, name, size_bytes, mime_type, kind, url) values ('10000000-0000-4000-a000-00000000000a', 'bad', 0, null, 'link', 'javascript:alert(1)')$$, '23514',
  'A link must be http(s), never javascript:');
select rls_test.expect_error($$insert into public.board_files (board_id, name, size_bytes, mime_type, kind, url) values ('10000000-0000-4000-a000-00000000000a', 'bad', 0, null, 'link', 'https://exa mple.com')$$, '23514',
  'A link cannot contain spaces');
select rls_test.expect_error($$insert into public.board_files (board_id, name, size_bytes, mime_type, kind, url) values ('10000000-0000-4000-a000-00000000000a', 'bad', 0, null, 'link', 'https://example.com/' || repeat('a', 2000))$$, '23514',
  'A link is at most 2000 characters');
select rls_test.expect_error($$insert into public.board_files (board_id, name, size_bytes, mime_type, kind, url) values ('10000000-0000-4000-a000-00000000000a', 'bad', 5, null, 'link', 'https://example.com')$$, '23514',
  'A link has no size');
select rls_test.expect_error($$insert into public.board_files (board_id, name, size_bytes, mime_type, kind, url) values ('10000000-0000-4000-a000-00000000000a', 'bad', 0, 'application/pdf', 'link', 'https://example.com')$$, '23514',
  'A link has no file type');
select rls_test.expect_error($$insert into public.board_files (board_id, name, size_bytes, mime_type, url) values ('10000000-0000-4000-a000-00000000000a', 'bad', 10, 'application/pdf', 'https://example.com')$$, '23514',
  'A file has no url');
select rls_test.expect_error($$insert into public.board_files (board_id, name, size_bytes, mime_type, kind) values ('10000000-0000-4000-a000-00000000000a', 'bad', 10, 'application/pdf', 'folder')$$, '23514',
  'Only files and links exist');
select rls_test.expect_error($$update public.board_files set url = 'https://evil.example' where kind = 'link'$$, '42501',
  'A link''s address cannot be edited (only its name)');
insert into public.board_files (board_id, name, size_bytes)
  select '10000000-0000-4000-a000-00000000000a', 'File ' || n, 100 from generate_series(4, 10) n;
select rls_test.expect_rows('select 1 from public.board_files', 10, 'Alice can hold ten files on a board');
select rls_test.expect_error($$insert into public.board_files (board_id, name, size_bytes) values ('10000000-0000-4000-a000-00000000000a', 'Eleventh.pdf', 100)$$, 'P0001',
  'An eleventh file is refused');
reset role;

select rls_test.act_as('00000000-0000-4000-a000-00000000000b');
select rls_test.expect_rows('select 1 from public.board_files', 0, 'Bob cannot list Alice''s files');
select rls_test.expect_affected($$update public.board_files set name = 'pwned'$$, 0, 'Bob cannot rename Alice''s files');
select rls_test.expect_affected($$delete from public.board_files$$, 0, 'Bob cannot delete Alice''s files');
select rls_test.expect_error($$insert into public.board_files (board_id, name, size_bytes) values ('10000000-0000-4000-a000-00000000000a', 'x.pdf', 100)$$, '42501',
  'Bob cannot add a file to Alice''s board (and a full board looks the same as any other)');
insert into public.board_files (board_id, name, size_bytes) values ('10000000-0000-4000-a000-00000000000b', 'Mine.pdf', 100);
select rls_test.expect_rows('select 1 from public.board_files', 1, 'Bob sees only his own file');
reset role;

select rls_test.act_as(null);
select rls_test.expect_rows('select 1 from public.board_files', 0, 'Anonymous cannot list files');
select rls_test.expect_error($$insert into public.board_files (board_id, name, size_bytes) values ('10000000-0000-4000-a000-00000000000a', 'x.pdf', 100)$$, '42501',
  'Anonymous cannot add a file');
reset role;

-- The bucket and its policies exist only where Storage does (see the
-- migration); the real Supabase image has it, the plain-Postgres stand-in
-- has a minimal copy.
select to_regclass('storage.objects') is not null as has_storage \gset
\if :has_storage
select rls_test.expect_rows($$select 1 from storage.buckets where id = 'board-files' and not public and file_size_limit = 20971520
  and 'image/png' = any (allowed_mime_types) and 'application/epub+zip' = any (allowed_mime_types) and not 'image/svg+xml' = any (allowed_mime_types)$$, 1,
  'The board-files bucket is private, capped at 20 MiB and accepts the new types but not SVG');

select rls_test.act_as('00000000-0000-4000-a000-00000000000a');
insert into storage.objects (bucket_id, name)
  values ('board-files', '10000000-0000-4000-a000-00000000000a/40000000-0000-4000-a000-0000000000a1.pdf');
select rls_test.expect_rows($$select 1 from storage.objects where bucket_id = 'board-files'$$, 1, 'Alice can upload and read her file''s object');
insert into storage.objects (bucket_id, name)
  values ('board-files', '10000000-0000-4000-a000-00000000000a/40000000-0000-4000-a000-0000000000a2.png');
select rls_test.expect_rows($$select 1 from storage.objects where bucket_id = 'board-files'$$, 2, 'An image uploads at its own path too');
select rls_test.expect_error($$insert into storage.objects (bucket_id, name) values ('board-files', '10000000-0000-4000-a000-00000000000a/40000000-0000-4000-a000-0000000000a2.pdf')$$, '42501',
  'An upload at the wrong extension for the row is refused');
select rls_test.expect_error($$insert into storage.objects (bucket_id, name) values ('board-files', '10000000-0000-4000-a000-00000000000a/not-a-row.pdf')$$, '42501',
  'An upload needs a file row at that path');
select rls_test.expect_error($$insert into storage.objects (bucket_id, name) values ('other-bucket', '10000000-0000-4000-a000-00000000000a/40000000-0000-4000-a000-0000000000a1.pdf')$$, '42501',
  'The policies only open the board-files bucket');
reset role;

select rls_test.act_as('00000000-0000-4000-a000-00000000000b');
select rls_test.expect_rows($$select 1 from storage.objects where bucket_id = 'board-files'$$, 0, 'Bob cannot read Alice''s object');
select rls_test.expect_error($$insert into storage.objects (bucket_id, name)
  values ('board-files', '10000000-0000-4000-a000-00000000000a/40000000-0000-4000-a000-0000000000a2.pdf')$$, '42501',
  'Bob cannot upload into Alice''s board');
-- Storage rejects any plain SQL delete outright ("use the Storage API"); the
-- API sets this for its own statements, and the RLS policies then decide
-- whose objects may go. Set it the same way, so this checks the policy.
select set_config('storage.allow_delete_query', 'true', true);
select rls_test.expect_affected($$delete from storage.objects where bucket_id = 'board-files'$$, 0, 'Bob cannot delete Alice''s object');
select set_config('storage.allow_delete_query', 'false', true);
reset role;

select rls_test.act_as(null);
select rls_test.expect_rows($$select 1 from storage.objects where bucket_id = 'board-files'$$, 0, 'Anonymous cannot read stored files');
reset role;

-- The delete policy needs the uploader's id on the object, which Storage
-- records on upload. The inserts above went straight to SQL, so none is set:
-- Alice can see these objects (her board lists the files) but isn't recorded
-- as their uploader. This is the check Bob's delete above can't be: he never
-- sees the objects, so the read policy stops him before this policy matters.
select rls_test.act_as('00000000-0000-4000-a000-00000000000a');
select set_config('storage.allow_delete_query', 'true', true);
select rls_test.expect_affected($$delete from storage.objects where bucket_id = 'board-files'$$, 0,
  'An object that does not record Alice as its uploader is not hers to delete');
reset role;
update storage.objects set owner_id = '00000000-0000-4000-a000-00000000000a' where bucket_id = 'board-files';
select rls_test.act_as('00000000-0000-4000-a000-00000000000a');
select rls_test.expect_affected($$delete from storage.objects where bucket_id = 'board-files'$$, 2,
  'Alice can delete the objects she uploaded');
reset role;
select set_config('storage.allow_delete_query', 'false', true);
\endif

-- Deleting a board takes its notes and edges with it.
select rls_test.act_as('00000000-0000-4000-a000-00000000000a');
delete from public.boards where id = '10000000-0000-4000-a000-00000000000a';
reset role;
select rls_test.expect_rows($$select 1 from public.nodes where board_id = '10000000-0000-4000-a000-00000000000a'$$, 0,
  'Deleting a board deletes its notes');
select rls_test.expect_rows($$select 1 from public.edges where board_id = '10000000-0000-4000-a000-00000000000a'$$, 0,
  'Deleting a board deletes its edges');
select rls_test.expect_rows($$select 1 from public.board_files where board_id = '10000000-0000-4000-a000-00000000000a'$$, 0,
  'Deleting a board deletes its file rows');

\o
\echo 'RLS tests passed: cross-user reads/writes, plan changes, board limit, board files and their storage, anonymous access, cascades.'
rollback;

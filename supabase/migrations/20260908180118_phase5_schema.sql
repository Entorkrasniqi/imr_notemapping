-- Phase 5: boards, nodes, edges, profiles — see docs/database.md for the
-- full design rationale. This migration creates exactly that schema.

-- ---------------------------------------------------------------------
-- profiles: one row per auth.users row, holding app-specific data we
-- don't want bolted onto Supabase's own managed table.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_owner_select" on public.profiles
  for select
  using (auth.uid() = id);

create policy "profiles_owner_update" on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- A new auth.users row (a real sign-up, or an anonymous session — both
-- create one) should always get a matching profile automatically, rather
-- than relying on application code to remember to insert one.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- boards
-- ---------------------------------------------------------------------
create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Untitled board',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists boards_user_id_idx on public.boards (user_id);

alter table public.boards enable row level security;

create policy "boards_owner_all" on public.boards
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- nodes
-- ---------------------------------------------------------------------
create table if not exists public.nodes (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  type text not null default 'note',
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  width double precision not null default 240,
  height double precision not null default 160,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nodes_board_id_idx on public.nodes (board_id);

alter table public.nodes enable row level security;

create policy "nodes_owner_all" on public.nodes
  for all
  using (
    exists (
      select 1 from public.boards
      where boards.id = nodes.board_id
      and boards.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.boards
      where boards.id = nodes.board_id
      and boards.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- edges
-- ---------------------------------------------------------------------
create table if not exists public.edges (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  source_node_id uuid not null references public.nodes (id) on delete cascade,
  target_node_id uuid not null references public.nodes (id) on delete cascade,
  source_handle text,
  target_handle text,
  created_at timestamptz not null default now()
);

create index if not exists edges_board_id_idx on public.edges (board_id);
create index if not exists edges_source_node_id_idx on public.edges (source_node_id);
create index if not exists edges_target_node_id_idx on public.edges (target_node_id);

alter table public.edges enable row level security;

create policy "edges_owner_all" on public.edges
  for all
  using (
    exists (
      select 1 from public.boards
      where boards.id = edges.board_id
      and boards.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.boards
      where boards.id = edges.board_id
      and boards.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- boards.updated_at: bumped whenever the board itself, or any of its
-- nodes/edges, changes — so "last updated" (used by the dashboard in
-- Phase 7) stays correct without every write path having to remember to
-- touch it by hand. Two separate trigger functions because the two cases
-- differ in what row they need to update: a direct edit to `boards` just
-- stamps the row already being written; a change to a `node`/`edge` has
-- to look up and update its *parent* board's row instead.
-- ---------------------------------------------------------------------
create function public.set_updated_at_now()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function public.touch_board_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  target_board_id uuid;
begin
  target_board_id := coalesce(new.board_id, old.board_id);
  update public.boards set updated_at = now() where id = target_board_id;
  return coalesce(new, old);
end;
$$;

create trigger boards_touch_updated_at
  before update on public.boards
  for each row execute function public.set_updated_at_now();

create trigger nodes_touch_board_updated_at
  after insert or update or delete on public.nodes
  for each row execute function public.touch_board_updated_at();

create trigger edges_touch_board_updated_at
  after insert or update or delete on public.edges
  for each row execute function public.touch_board_updated_at();

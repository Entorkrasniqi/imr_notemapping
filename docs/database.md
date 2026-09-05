# NoteMap — Database Architecture

Status: Phase 0 (planning). This schema is implemented in Phase 5.

## 1. Why Postgres (via Supabase)

- The data is genuinely relational: a board *has* nodes, nodes are
  *connected by* edges, a user *owns* boards. Foreign keys let the database
  itself guarantee an edge can't point at a node that doesn't exist, or a
  node can't belong to a board that isn't the current user's.
- **Row Level Security (RLS)** is a Postgres feature, not a Supabase
  invention — Supabase just wires your auth session's JWT into
  `auth.uid()` so RLS policies can reference it. This means authorization
  is enforced *in the database*, so a bug in frontend code cannot leak or
  corrupt another user's data. This directly satisfies the brief's
  requirement to never rely only on frontend checks.
- **JSONB** columns let us store Tiptap's structured rich-text document
  without forcing rich text into a rigid relational shape. We get schema
  flexibility for content while keeping structural data (position, size,
  ownership) properly typed and indexed.

## 2. Schema

### `profiles`
*(extends `auth.users`, which Supabase manages and we don't touch directly)*

| column | type | notes |
|---|---|---|
| `id` | uuid, PK | same value as `auth.users.id` (1:1) |
| `plan` | text | `'free'` \| `'pro'`, default `'free'`. This is the seam for Stripe later — no schema change needed to add billing, just start setting this field from a webhook. |
| `created_at` | timestamptz | default `now()` |

Why add this table at all, when the brief's draft schema didn't have it?
`auth.users` is managed by Supabase Auth and we shouldn't add arbitrary
app-specific columns to it directly. A `profiles` table with a 1:1 relation
is the standard Supabase pattern for "extra data about a user."

### `boards`

| column | type | notes |
|---|---|---|
| `id` | uuid, PK | default `gen_random_uuid()` |
| `user_id` | uuid, FK → `auth.users.id` | owner; `not null` |
| `name` | text | `not null`, default `'Untitled board'` |
| `created_at` | timestamptz | default `now()` |
| `updated_at` | timestamptz | default `now()`, bumped by trigger on any node/edge change (see §4) |

### `nodes`

| column | type | notes |
|---|---|---|
| `id` | uuid, PK | default `gen_random_uuid()` |
| `board_id` | uuid, FK → `boards.id` (`on delete cascade`) | |
| `type` | text | default `'note'`. Kept as free text (not an enum) so new node types — image, group/frame, etc. — don't require a migration later. |
| `position_x` | double precision | `not null`, default `0` |
| `position_y` | double precision | `not null`, default `0` |
| `width` | double precision | `not null`, default `240` |
| `height` | double precision | `not null`, default `160` |
| `content` | jsonb | Tiptap's JSON document. Default `'{}'`. |
| `created_at` | timestamptz | default `now()` |
| `updated_at` | timestamptz | default `now()` |

### `edges`

| column | type | notes |
|---|---|---|
| `id` | uuid, PK | default `gen_random_uuid()` |
| `board_id` | uuid, FK → `boards.id` (`on delete cascade`) | denormalized on purpose — see §5 |
| `source_node_id` | uuid, FK → `nodes.id` (`on delete cascade`) | |
| `target_node_id` | uuid, FK → `nodes.id` (`on delete cascade`) | |
| `source_handle` | text, nullable | React Flow handle id (a node can have multiple connection points) |
| `target_handle` | text, nullable | |
| `created_at` | timestamptz | default `now()` |

## 3. Relationships

```
auth.users (1) ──── (1) profiles
auth.users (1) ──── (∞) boards
boards     (1) ──── (∞) nodes
boards     (1) ──── (∞) edges
nodes      (1) ──── (∞) edges   (as source)
nodes      (1) ──── (∞) edges   (as target)
```

`on delete cascade` on `board_id`/`node_id` foreign keys means deleting a
board (or a node) automatically removes its dependent rows — we don't have
to orchestrate multi-table deletes from application code, which would be
another place a bug could leave orphaned rows.

## 4. Changes from the brief's draft schema, and why

1. **Added `profiles`** — needed for the free-plan limit and the future
   subscription flag; see §1 and §6.
2. **`content` is `jsonb`, not a generic column** — rich text needs a
   structured document, not a plain string.
3. **`type` on nodes is `text` with a default, not an enum** — avoids a
   schema migration every time a new node type is introduced (explicitly a
   "future feature" per the brief: images, groups, etc.).
4. **`edges.board_id` is denormalized** (it's technically derivable by
   joining through `nodes`) — this makes "fetch everything for board X" a
   single indexed query per table instead of a join, and makes RLS
   policies on `edges` simpler (see §5) and cheaper to evaluate.
5. **`updated_at` on `boards`** is maintained by a trigger, not by
   application code remembering to set it — used by the dashboard's "last
   updated" display (Phase 7) and must stay correct even if a future code
   path forgets to touch it.

## 5. Row Level Security

RLS is **enabled** on `boards`, `nodes`, and `edges`. Policies (SQL,
implemented in Phase 5/6):

```sql
alter table boards enable row level security;
alter table nodes  enable row level security;
alter table edges  enable row level security;

-- boards: owner-only, on every operation
create policy "boards_owner_all" on boards
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- nodes: ownership is inherited through the parent board
create policy "nodes_owner_all" on nodes
  for all
  using (
    exists (select 1 from boards
            where boards.id = nodes.board_id
            and boards.user_id = auth.uid())
  )
  with check (
    exists (select 1 from boards
            where boards.id = nodes.board_id
            and boards.user_id = auth.uid())
  );

-- edges: same pattern, and this is exactly why board_id is
-- denormalized onto edges — the check doesn't need to join through nodes.
create policy "edges_owner_all" on edges
  for all
  using (
    exists (select 1 from boards
            where boards.id = edges.board_id
            and boards.user_id = auth.uid())
  )
  with check (
    exists (select 1 from boards
            where boards.id = edges.board_id
            and boards.user_id = auth.uid())
  );
```

`for all` covers select/insert/update/delete with one policy per table;
`using` gates which existing rows are visible/affected, `with check` gates
what a write is allowed to create/change into. Both are needed — `using`
alone would let you insert a row you could never see again if it didn't
match, and no `with check` would let you insert rows you don't own.

## 6. Free-plan limit (3 boards)

Per the brief, this must not be a frontend-only check. Two layers:

1. **Application-level check** before showing the "create board" action as
   available (fast, good UX — the error is prevented, not just caught).
2. **Database-level enforcement** via a `before insert` trigger on `boards`
   that counts the user's existing boards (or checks `profiles.plan`) and
   raises an exception if a free user already has 3. This is what actually
   prevents bypass — RLS policies can't easily express "count of existing
   rows," so a trigger function is the right tool here, not another RLS
   policy.

This will be written out fully in Phase 7, once boards/dashboard exist to
test it against.

## 7. Primary keys, foreign keys, CRUD — quick reference

- **Primary key**: uniquely identifies a row. Every table uses a
  `uuid` generated by the database (`gen_random_uuid()`), not an
  auto-incrementing integer — UUIDs are safe to generate client-side too
  (useful for optimistic UI) and don't leak row counts.
- **Foreign key**: a column whose value must match a primary key in
  another table (or be null, if nullable). This is what lets Postgres
  reject "insert an edge pointing at a node that doesn't exist."
- **CRUD** happens via the Supabase JS client directly from the browser
  (`supabase.from('nodes').select/insert/update/delete(...)`), with RLS as
  the authorization boundary — there is no separate REST/GraphQL layer we
  maintain by hand.

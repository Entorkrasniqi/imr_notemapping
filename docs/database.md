# NoteMap — Database Architecture

Status: implemented in Phase 5 (see §4a for what changed along the way).
Phase 6 added real sign-up/login on top of this exact schema — RLS never
needed to change, since it was never conditioned on "anonymous vs. real,"
only on `auth.uid()` resolving to *some* row in `auth.users`. Phase 7
dropped the Phase 5 one-board-per-user constraint and implemented the
free-plan limit trigger that §6 had described but deferred.

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
| `plan` | text | `'free'` \| `'pro'`, default `'free'`. Set from `app/api/stripe/webhook/route.ts` as of Phase 9 — see §6a. |
| `stripe_customer_id` | text, unique, nullable | Phase 9. Set the first time a user starts Checkout; the join key the webhook uses to find which `profiles` row an incoming event is about. |
| `stripe_subscription_id` | text, nullable | Phase 9. The active subscription backing `plan = 'pro'`, if any. |
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

## 4a. Changes made *during* Phase 5 implementation

The four sections above were written in Phase 0, before any of this had
actually been built against a real database. Three things came up only
once real client code was hitting it:

1. **`nodes.expanded_height`** (nullable `double precision`) — added after
   the closed/open note collapse behavior existed in the app but not in
   this document. A closed note shrinks to a fixed height and remembers
   its real, user-set height for reopening; `height` alone can't hold both
   meanings, since whichever one was true at the moment of the last save
   would be the only one left.
2. **`boards.user_id default auth.uid()`** — the client no longer sends
   `user_id` on insert at all. It's set by Postgres itself, from the JWT
   of the exact request doing the inserting. This isn't a security fix —
   RLS's `with check` already rejected a mismatched client-supplied value
   — it's a robustness one: a client-supplied value can be captured
   slightly before it's used, and in that gap a concurrent session change
   (a second tab, or React StrictMode's intentional double-mount in
   development) can make it stale.
3. **`boards_user_id_unique`** — a `unique (user_id)` constraint. Finding
   or creating a user's board is a select, then (if empty) an insert —
   not one atomic operation, so two concurrent calls can both see "no
   board" and both insert one. This constraint turns the loser into a
   clean `23505` error the application code catches and recovers from by
   re-fetching the winner, rather than a second, orphaned board silently
   existing. It was a **Phase 5-specific simplification** for "one
   implicit board per user, no dashboard yet" — **dropped in Phase 7**
   (`boards_drop_one_per_user` migration) once the dashboard added real
   multi-board support, with the free-plan limit trigger (§6) taking over
   as the actual cap.

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

Implemented in Phase 7 (`boards_free_plan_limit` migration). Per the
brief, this must not be a frontend-only check — two layers:

1. **Application-level check** (`lib/supabase/boards.ts`'s
   `FREE_PLAN_BOARD_LIMIT`, used by the dashboard) disables the "+ Create
   board" action once the user already has 3 boards, and shows a message
   explaining why — fast, good UX, the error is prevented rather than
   just caught.
2. **Database-level enforcement** via `enforce_free_plan_board_limit()`, a
   `before insert` trigger function on `boards`. It looks up the
   inserting user's `profiles.plan`; a non-`'free'` plan (or a missing
   profile row, defensively) is let through unconditionally, otherwise it
   counts that user's existing boards and raises a `P0001` exception if
   there are already 3 or more. This is the layer that actually can't be
   bypassed — RLS's `using`/`with check` can only evaluate the row being
   read or written, with no way to express "count of existing rows,"
   which is exactly why this needed a trigger rather than another RLS
   policy. Verified directly against the live database: a user's 3rd
   board insert succeeds, a 4th is rejected with
   `{"code":"P0001","message":"Free plan is limited to 3 boards"}`, and
   the Supabase JS client surfaces that as a normal `PostgrestError` the
   application code catches (`BoardLimitError` in `boards.ts`).

## 6a. Billing and the `profiles` write lockdown (Phase 9)

`enforce_free_plan_board_limit()` only ever checks what `profiles.plan`
*already says* — nothing in §6 stopped a signed-in user from changing that
value themselves. Until Phase 9, `profiles_owner_update`'s `using`/
`with check: auth.uid() = id` let any authenticated client run
`supabase.from('profiles').update({ plan: 'pro' })` on their own row
directly from the browser, silently defeating the free-plan limit — RLS
policies restrict which *rows* a write can touch, not which *columns*, so
"owner can update their own row" and "owner can grant themselves Pro" were
the same policy. The `profiles_lock_down_writes` migration drops that
policy and revokes `insert`/`update`/`delete` on `profiles` from `anon`
and `authenticated` entirely — nothing in the app depended on writing to
it as a normal user (the one-row-per-user insert is done by
`handle_new_user()`, a `security definer` trigger that runs as its owner,
not as `authenticated`).

That makes `plan` (and the `stripe_customer_id`/`stripe_subscription_id`
columns added alongside it) writable only through paths that bypass RLS
outright: the Supabase Studio SQL editor, or a `service_role`-keyed
client. `lib/supabase/admin.ts` is the only place in the app that holds
such a client, and it's used from exactly two places — both server-only
Route Handlers, never a Server Component or anything a browser talks to
directly: `app/api/stripe/checkout/route.ts` (writes `stripe_customer_id`
the first time a signed-in user starts a purchase, after verifying their
identity with `getUser()`) and `app/api/stripe/webhook/route.ts` (writes
`plan`/`stripe_subscription_id` when Stripe's signed event payload says a
subscription changed — see `docs/architecture.md` §3 for why this route
in particular has no session to check at all).

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

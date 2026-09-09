# NoteMap — System Architecture

Status: Phase 0 (planning). No application code exists yet.

## 1. What we're building

NoteMap is an infinite-canvas mind-mapping tool where each "node" on the
canvas is a rich-text note. Notes can be moved, resized, and connected with
arrows. The board pans and zooms like a whiteboard. Boards are private,
persisted per-user, and gated behind auth.

This document describes the shape of the system *before* code exists, so
that later phases have a map to build against instead of accreting
decisions ad hoc.

## 2. Tech stack and why

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) | One codebase for marketing/auth pages (server-rendered, fast) and the heavily client-side canvas app. File-based routing keeps `/dashboard`, `/board/[id]`, `/login` simple. |
| Language | TypeScript (strict) | The data model (nodes, edges, positions, content) flows through many layers — canvas library, editor, DB. Types catch mismatches (e.g. `position_x` as string vs number) at compile time instead of at runtime on a canvas. |
| Styling | Tailwind CSS | Utility classes keep small, numerous UI pieces (toolbar buttons, handles, dashboard cards) fast to build without inventing a component-styling convention from scratch. |
| Canvas / graph | React Flow (`@xyflow/react`) | Purpose-built for exactly this: pannable/zoomable canvas, draggable/resizable nodes, connectable edges with handles, viewport state, minimap. Reinventing this (hit-testing, coordinate transforms, edge routing) is a multi-week project on its own and not the point of this exercise. |
| Rich text | Tiptap | A ProseMirror wrapper that gives us a document model (JSON, not raw HTML strings) with clean extension points for bold/italic/headings/lists/color/highlight. Storing structured JSON (not HTML) avoids sanitization/XSS headaches later. |
| Backend / DB | Supabase (Postgres + Auth + Row Level Security) | Gives us a real relational database, auth, and authorization (RLS) without hand-rolling a backend server. The Supabase JS client can talk to Postgres directly from the browser because RLS — not application code — is the security boundary. This matches the "don't rely on frontend checks" requirement directly. |

Explicitly **not** introduced yet: Zustand or Redux, Stripe, realtime
collaboration, ORMs (Prisma etc.). Supabase's JS client plus React state is
enough for the current phases; we add libraries when a phase's requirements
actually demand them, not preemptively.

## 3. High-level shape

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (client)                     │
│                                                               │
│  ┌───────────────┐   ┌────────────────────────────────────┐ │
│  │  Dashboard UI │   │              Board UI                │ │
│  │ (list boards, │   │  ┌────────────┐  ┌─────────────────┐│ │
│  │  create/rename│   │  │ React Flow │  │ Tiptap editor   ││ │
│  │  /delete)     │   │  │ (canvas,   │  │ (inline in the  ││ │
│  │               │   │  │  nodes,    │  │  note; toolbar  ││ │
│  │               │   │  │  edges,    │  │  floats below   ││ │
│  │               │   │  │  viewport) │  │  the canvas)    ││ │
│  │               │   │  └─────┬──────┘  └────────┬────────┘│ │
│  └───────┬───────┘   └────────┼──────────────────┼─────────┘ │
│          │                    │  local component state       │
└──────────┼────────────────────┼──────────────────┼───────────┘
           │                    │  (debounced autosave)
           ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase (hosted service)                │
│  ┌───────────┐   ┌─────────────────────────────────────┐    │
│  │   Auth    │   │        Postgres (with RLS)           │    │
│  │ (sessions,│   │  boards / nodes / edges / profiles   │    │
│  │  JWT)     │   │  policies: auth.uid() = owner         │    │
│  └───────────┘   └─────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

Next.js's role here is mostly **routing and page shell** — the dashboard
and board pages, the auth pages, layout/navigation. It is not acting as a
traditional backend-for-frontend with its own API routes for CRUD, because
Supabase + RLS lets the browser talk to Postgres safely. We'll introduce a
Next.js server-side route only where it's genuinely needed later (e.g. a
Stripe webhook, which must run server-side with a secret key).

## 4. Frontend architecture

Directory layout (created incrementally as phases need it — not all of
this exists after Phase 0):

```
/app                    Next.js App Router routes
  /login                ✓ Phase 6
  /signup               ✓ Phase 6
  /                     ✓ Phase 7 — the dashboard (board list) now lives
                         at the root route; the canvas moved out to
                         /board/[boardId] below
  /board/[boardId]      ✓ Phase 7 — the canvas, one route per board
  error.tsx             ✓ Phase 8 — catches unexpected runtime errors
                         anywhere under /app in a React error boundary
  not-found.tsx         ✓ Phase 8 — friendly 404 for any unmatched URL
                         (only reachable signed-in — proxy.ts redirects
                         signed-out visitors to /login first, including
                         for URLs that don't exist)
/components
  /canvas                React Flow wrapper, custom node/edge components,
                         NoteEditorModal.tsx (the note-editing surface —
                         a portal-rendered modal, not an on-canvas panel)
  /editor                Tiptap editor + toolbar, both mounted inside
                         NoteEditorModal now rather than on the canvas
  /dashboard             ✓ Phase 7 — Dashboard.tsx: board list, create/
                         rename (double-click a name, or the keyboard-
                         reachable pencil button added in Phase 8)/
                         delete/open, free-plan limit messaging
  /theme                 ✓ Phase 8 — ThemeToggle.tsx, the light/dark/
                         blueprint switcher shared by the dashboard and
                         board headers
/lib
  /supabase              ✓ Supabase client factory — browser (Phase 5) +
                         server (Phase 6) variants, both now in use; plus
                         board-sync.ts (single-board load/save) and
                         boards.ts (Phase 7 — dashboard CRUD + listing)
  /theme                 ✓ Phase 8 — theme-context.tsx: the ThemeProvider
                         and useTheme() hook backing ThemeToggle, plus the
                         inline anti-flash script injected in layout.tsx
/hooks                   Reusable hooks (useBoardHistory, useSupabaseBoardSync, …)
/types                   Shared TypeScript types (Node content, Board, Edge)
/docs                    This document and friends
proxy.ts                 ✓ Phase 6 — route protection + session refresh,
                         at the project root (not under /app — this is
                         Next.js 16's renamed `middleware.ts`, see its own
                         top-of-file comment). No changes needed for
                         Phase 7: `/board/[boardId]` is protected by the
                         same "anything not in PUBLIC_PATHS" rule as
                         every other route.
```

Guiding rules for this layer:

- **Canvas state lives in React Flow's model** (`nodes`, `edges` arrays with
  position/size/data), not duplicated into a second parallel state tree.
  Each node's `data` field holds a reference to its Tiptap JSON content.
- **Editor state lives in Tiptap**, scoped to whichever one note is
  currently open for editing — at most one live editor instance ever
  exists; every note tile on the canvas renders static, read-only content
  instead, all the time. Editing doesn't happen in place on the canvas:
  opening a note mounts `NoteEditorModal`, a large centered panel with
  its own backdrop, rendered via a React portal straight to
  `document.body` — deliberately outside React Flow's own DOM tree, not
  merely styled to look on top of it, so panning/zooming/clicking the
  canvas simply can't happen while it's open; nothing behind the backdrop
  is reachable at all. That modal's *formatting toolbar* lives in its own
  footer, and finds the active editor through a small shared context
  rather than through props (`lib/editor/active-editor-context.tsx`) —
  the text and the controls for it are still in different components, now
  just both inside the same modal instead of one being on the canvas and
  the other in a floating dock elsewhere on screen.
- **Persistence is a separate concern from interaction.** Local phases
  (1–4) keep everything in memory/localStorage. Supabase is introduced in
  Phase 5 as a sync layer underneath the same React Flow state, not as a
  replacement for it. This is why Phase 4 (local persistence) matters: it
  forces us to nail serialization before a network is involved.

## 5. Data flow

As of Phase 7, `/` is the dashboard: it lists the signed-in user's boards
(name, last updated, note count — via `lib/supabase/boards.ts`'s
`listBoards`, which uses PostgREST's embedded `nodes(count)` to avoid an
N+1 query per card) and lets them create/rename/delete/open one. Opening
a board navigates to `/board/[boardId]`, which is where the flow below
actually happens. (Phase 5 first proved the load/save half of this flow
against an anonymous session, before any login screen or dashboard
existed — see `docs/database.md` §4a. RLS never had to change across any
of these phases: it only ever asked whether `auth.uid()` resolved to
*some* real row in `auth.users`, anonymous or not, and separately whether
that row owned the board being asked about.)

1. User loads `/board/[boardId]`, having navigated there from the
   dashboard (or via a bookmarked/typed URL).
2. Page confirms the board id resolves to a row the signed-in user
   actually owns (`verifyBoardAccess` in `board-sync.ts`) — RLS makes "no
   such board" and "someone else's board" look identical, a deliberate
   choice covered in that function's own comment — then fetches the
   board's nodes/edges (again RLS-scoped).
3. Data is converted into React Flow's `Node[]`/`Edge[]` shape and used to
   initialize the canvas.
4. User interacts (moves a note, edits text, draws a connection). React
   Flow's local state updates immediately (no network round-trip needed to
   *see* the change — this is what makes it feel fast).
5. Changes are autosaved to Supabase on a debounce (e.g. after ~500ms of
   inactivity, or on drag-end/blur), not on every pixel of movement.
6. Row Level Security policies enforce, at the database level, that this
   write can only affect rows owned by the authenticated user — so even if
   client code had a bug, another user's data can't be read or corrupted.

## 6. Zoom-based rendering

React Flow exposes the current zoom level via its viewport state. Phase 1
only needs *correct* pan/zoom (nodes stay where they are, content stays
readable, nothing breaks at extreme zoom). Any "simplify content at low
zoom" behavior (per the mockups in the brief) is a later refinement layered
on top of that same viewport value — we will not build it until basic
zoom works, per the brief's own instruction not to over-engineer this
early.

## 7. Future scalability (designed for, not built now)

- **Subscriptions**: the `profiles` table (see `database.md`) carries a
  `plan` field now, defaulting to `'free'`. Adding Stripe later means
  adding a webhook route and flipping this field — not restructuring the
  schema or the board-limit check.
- **Sharing / collaboration**: boards are owned by a single `user_id` now.
  A future `board_members` join table can be added without touching the
  `boards`/`nodes`/`edges` tables themselves.
- **Realtime collaboration**: Supabase Realtime can subscribe to
  `nodes`/`edges` table changes later; because persistence already flows
  through those tables (not a bespoke format), enabling Realtime is additive.

## 8. What we are *not* doing yet

No Supabase project, no auth, no database calls, no Tiptap, no React Flow
installed. Phase 0 is documentation only, so decisions are visible and
questionable before they're expensive to change.

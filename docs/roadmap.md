# NoteMap — Roadmap

This tracks phase status. Each phase is scoped deliberately narrow — see
`architecture.md` for the system design these phases build toward.

## Phase status

- [x] **Phase 0 — Architecture.** `docs/architecture.md`, `docs/database.md`,
      this file. No application code yet.
- [x] **Phase 1 — Basic infinite canvas.** Next.js app scaffolded. Pan,
      zoom, select, create/move/resize/delete a note. Temporary in-memory
      state only, no persistence, no auth.
- [x] **Phase 2 — Rich text.** Tiptap integrated into each note: bold,
      italic, underline, headings, bullet/numbered lists, alignment, text
      size, text color, highlight, undo/redo.
- [x] **Phase 3 — Connections.** Connection handles on notes, drag-to-connect
      arrows, edge selection and deletion, edges stay attached when notes
      move.
- [x] **Phase 4 — Local persistence.** Board state (nodes + edges) survives
      a page reload via serialization to `localStorage`.
- [x] **Phase 5 — Supabase.** Real Postgres schema (see `database.md`)
      replaces local persistence. "Authenticated" for now means an
      anonymous Supabase session (see `lib/supabase/board-sync.ts`) — real
      sign-up/login is Phase 6; RLS can't tell the difference either way.
- [x] **Phase 6 — Authentication.** Supabase Auth signup/login/logout,
      protected routes (`proxy.ts`), Row Level Security verified with two
      real accounts. Replaces Phase 5's anonymous-session bridge — RLS
      itself didn't need to change at all.
- [x] **Phase 7 — Dashboard.** Board list (name, last updated, note count),
      create/rename/delete/open, 3-board free-plan limit enforced at both
      the UI and database level.
- [x] **Phase 8 — Polish.** Loading/error/empty states (`app/error.tsx`,
      `app/not-found.tsx`), keyboard shortcuts (Escape to stop editing,
      Ctrl+Y as an alternate redo), autosave refinement (a visible
      Saving…/Saved indicator, and no more redundant just-after-load
      save), undo/redo (unchanged, already solid — verified, not
      rebuilt), accessibility (keyboard-reachable board rename, toolbar
      `aria-label`/`aria-pressed`), general responsive layout (breakpoints,
      not touch input — see Phase 15 for that). Two real bugs found and
      fixed along the way, not just polish: Backspace while editing a
      note's text was never actually at risk of deleting the note (verified,
      not assumed), but renaming a board to anything containing a space and
      pressing Enter was silently navigating away instead of saving — caused
      by an `<input>` invalidly nested inside a `<button>`, fixed by
      restructuring the board card's clickable area to a
      `div[role="button"]` with its own keyboard handling.
- [ ] **Phase 9 — Billing.** Stripe Checkout + customer portal for
      upgrading/downgrading; a webhook route (the app's first genuinely
      server-side endpoint — everything before this talks to Supabase
      directly from the browser) syncs `profiles.plan` on subscription
      events. Makes self-service what's currently a manual
      `update profiles set plan = 'pro'` — the Phase 7 trigger already
      unlimits any non-`'free'` plan, so no schema change needed, just a
      real way for `plan` to change.
- [ ] **Phase 10 — Sharing.** A `board_members` join table (anticipated
      since Phase 0, see `architecture.md` §7) so a board can have
      collaborators, not just an owner; a share dialog with viewer/editor
      roles; RLS policies extended from "owner-only" to "owner or member."
      Public (link-accessible, no login) boards are a stretch goal here,
      not required for the phase.
- [ ] **Phase 11 — Real-time collaboration.** Supabase Realtime
      subscriptions on `nodes`/`edges` so collaborators added in Phase 10
      see each other's changes live, plus presence (who else is on the
      board right now). Depends on Phase 10 existing — no point
      real-time-syncing a board only one person can access.
- [ ] **Phase 12 — Search & organization.** Search across board names and
      note content from the dashboard; tags on boards for filtering once
      a user has more than a handful.
- [ ] **Phase 13 — Export & templates.** Export a board to PNG/PDF;
      save-as-template and create-board-from-template.
- [ ] **Phase 14 — History & appearance.** Version history — browse and
      restore a board's past states from the database, distinct from the
      in-session undo/redo Phase 3 already built, which doesn't survive a
      reload. Dark mode.
- [ ] **Phase 15 — Mobile & touch.** Touch-first canvas interactions
      (pinch-to-zoom, touch-drag, formatting controls sized for touch) —
      distinct from Phase 8's general responsive layout pass, which
      covers breakpoints and keyboard/screen-reader behavior but not
      touch gestures on the canvas itself.

## Notes on phases 9-15

These extend the roadmap past the original 8-phase brief, turning what
was previously one flat "explicitly deferred, none built yet" list into
an ordered plan. The ordering favors things that unlock other things
(billing before "unlimited boards" is real; sharing before real-time,
since syncing a single-owner board live has no audience) and defers the
largest, most self-contained efforts (history, mobile) to the end. This
ordering is a proposal, not a commitment — revisit it before starting
Phase 9 if priorities have shifted.

## Git convention

One commit (or small commit series) per phase, e.g.:

```
feat: add infinite canvas and note nodes         (Phase 1)
feat: integrate Tiptap rich text editing         (Phase 2)
feat: add node connections with React Flow edges (Phase 3)
feat: add local persistence via localStorage     (Phase 4)
feat: connect Supabase and persist boards        (Phase 5)
feat: add Supabase auth and RLS-protected boards (Phase 6)
feat: add dashboard with free-plan board limit   (Phase 7)
chore: polish, accessibility, performance         (Phase 8)
feat: add Stripe billing and plan webhook         (Phase 9)
feat: add board sharing and collaborator roles    (Phase 10)
feat: add real-time collaboration via Realtime    (Phase 11)
feat: add search, tags, and board organization    (Phase 12)
feat: add board export and templates              (Phase 13)
feat: add version history and dark mode           (Phase 14)
feat: add touch-first mobile canvas interactions  (Phase 15)
```

Commits are suggested at the end of each phase along with what to test
first — not made automatically.

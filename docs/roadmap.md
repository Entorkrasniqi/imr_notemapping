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
- [ ] **Phase 4 — Local persistence.** Board state (nodes + edges) survives
      a page reload via serialization to `localStorage`.
- [ ] **Phase 5 — Supabase.** Real Postgres schema (see `database.md`)
      replaces local persistence for authenticated users.
- [ ] **Phase 6 — Authentication.** Supabase Auth signup/login/logout,
      protected routes, Row Level Security verified with two real accounts.
- [ ] **Phase 7 — Dashboard.** Board list (name, last updated, note count),
      create/rename/delete/open, 3-board free-plan limit enforced at both
      the UI and database level.
- [ ] **Phase 8 — Polish.** Loading/error/empty states, keyboard shortcuts,
      autosave refinement, undo/redo, performance pass, accessibility,
      responsive behavior.

## Explicitly deferred (design allows for these, none are built yet)

Stripe subscriptions, unlimited boards for Pro, board sharing,
collaboration, public boards, board templates, export to PDF/image,
search, tags, dark mode, version history, real-time collaboration,
mobile/tablet support.

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
```

Commits are suggested at the end of each phase along with what to test
first — not made automatically.

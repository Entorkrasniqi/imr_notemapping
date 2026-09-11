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
- [x] **Phase 9 — Billing.** Stripe Checkout + customer portal for
      upgrading/downgrading; a webhook route (the app's first genuinely
      server-side endpoint — everything before this talks to Supabase
      directly from the browser) syncs `profiles.plan` on subscription
      events. Two `profiles` columns added (`stripe_customer_id`,
      `stripe_subscription_id` — the join key back to Stripe; `plan`
      itself already existed since Phase 5). The Dashboard's "Upgrade to
      Pro"/"Manage billing" buttons are plain `<form method="POST">`s
      targeting `/api/stripe/checkout` and `/api/stripe/portal` — each
      Route Handler creates a Stripe Checkout/Portal Session and
      `redirect()`s straight to Stripe's hosted URL, so no client-side
      Stripe.js or publishable key is needed at all (redirect-based
      Checkout only ever needs the secret key, server-side). Found while
      building this, not assumed: the `profiles_lock_down_writes`
      migration written back in Phase 7/8 had only ever been saved to
      the repo, never actually applied to the live database — the plan
      self-upgrade hole it closes was open the whole time. Applied
      together with the new Stripe columns once billing gave a concrete
      reason to revisit it.
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

## Ongoing: Maintainability

Not a numbered phase — this isn't a one-time deliverable, it's a standing
practice meant to run alongside every phase from here on. None of Phases
1-9's application code shipped with it, and debt compounds fastest right
when new phases keep building on top of untested code.

- **Tests.** No test framework exists yet — `package.json` only wires up
  `eslint`. Add Vitest (plus React Testing Library for component tests)
  and start with the code most expensive to get wrong silently:
  `lib/supabase/board-sync.ts` (`verifyBoardAccess` deliberately makes "no
  such board" and "someone else's board" look identical — exactly the
  kind of behavior a refactor could break without anyone noticing),
  `app/api/stripe/webhook` (signature verification and the `profiles.plan`
  sync), and the free-plan board-limit enforcement from Phase 7. Not full
  coverage on day one — coverage grows alongside whichever phase is
  currently being touched, plus a regression test any time a real bug
  gets fixed (like the two found during Phase 8, or the unapplied RLS
  migration found during Phase 9), so it can't silently come back.
- **CI.** A GitHub Actions workflow running `npm run lint`, `tsc --noEmit`,
  and the test suite above on every push and PR. Right now nothing
  enforces green lint/types/tests before merge — it's only as reliable as
  remembering to run it locally. This is what turns "tests exist" into
  "tests actually get checked."
- **Database migration discipline (the big one).** Phase 9's own finding
  (`profiles_lock_down_writes` written to the repo but never applied to
  production) is a textbook DevOps failure mode: migrations as code with
  no enforced apply step. Put `supabase db push` (or equivalent) into the
  deploy pipeline itself, so "migration exists in the repo" and
  "migration is live" can never diverge again — not something a test
  suite would ever catch.
- **Environment & secrets.** Audit that `.env*` is actually gitignored,
  define which secrets live where (`vercel env` per environment:
  dev/preview/prod), and a rotation plan for the Stripe secret key and
  Supabase `service_role` key specifically, since `admin.ts` already
  flags that key as RLS-bypassing by design.
- **Staging parity.** Right now it's one Supabase project. A second
  project (or branched Postgres) for preview deploys means schema
  changes and Stripe webhook changes get exercised against
  non-production data before they touch real customers.
- **Observability/alerting.** Not just "add Sentry" but specifically:
  alert on Stripe webhook failures (a silent failure there desyncs
  `profiles.plan` from what the customer is actually paying for), and
  uptime/error-rate monitoring on `/board/[boardId]` and the dashboard as
  the two routes real usage depends on.
- **Backup/DR.** Confirm Supabase's automated backups are actually
  enabled on the plan being used, and periodically test a real restore,
  not just assume backups work.
- **Rollback safety.** Vercel makes app rollback instant, but a
  rolled-back app version can break against a newer DB schema if
  migrations aren't backward-compatible. Worth adopting an
  expand/contract pattern for schema changes once Phase 10+ starts
  touching the schema more (`board_members`).
- **Supply chain.** Dependabot/Renovate for patching, plus `npm audit` or
  Snyk in CI, and secret-scanning (gitleaks) so a committed key gets
  caught before merge, not after.
- **Release consistency.** The desktop track's D6 (multi-platform CI
  release pipeline) and the web app's deploy process are currently two
  unrelated stories; worth one shared release/versioning convention
  across both once desktop work starts.

Start requiring tests and CI on new code from Phase 10 (Sharing) onward,
without stopping to retrofit full coverage onto Phases 1-9 first. The
rest of this list — migration pipeline, staging parity, observability,
backups, supply chain — can be adopted incrementally, each one whenever
it becomes the actual bottleneck rather than all at once; migration
discipline and secrets hygiene are the two worth prioritizing earliest,
since both are the kind of gap that stays invisible until it causes real
damage.

## Ongoing: Security (optional)

Also not a numbered phase, and explicitly optional — none of this blocks
Phase 10+, but it's the defensive-security counterpart to the
maintainability list above, worth picking up incrementally rather than
ignoring until something goes wrong.

- **RLS policy testing.** Phase 6 verified RLS "with two real accounts,"
  once, manually. Turn that into an automated suite that attempts
  cross-user reads/writes against `boards`/`nodes`/`edges` directly (not
  just through the app's own queries), run in CI on every migration that
  touches those tables — especially before Phase 10, since "owner-only"
  → "owner or member" is exactly the kind of policy change that quietly
  introduces an authorization hole. This is the highest-priority item
  here: RLS is the one security boundary the whole architecture depends
  on.
- **IDOR / direct API access.** `verifyBoardAccess`'s "no such board" vs
  "someone else's board" ambiguity only helps if every code path goes
  through it. Worth explicitly testing whether a signed-in user can query
  another user's `nodes`/`edges` rows directly via the Supabase client,
  in case a policy is missing or too permissive on those child tables
  specifically.
- **`service_role` key exposure.** `admin.ts` is already flagged as
  RLS-bypassing and currently only touched by the Stripe Route Handlers.
  Add a lint rule or CI check that fails the build if anything under
  `/app`'s client components (or the browser bundle generally) ever
  imports it — that key leaking is a full data-access bypass, not just
  bad practice.
- **Rich text XSS.** Tiptap storing JSON "avoids sanitization headaches"
  per `architecture.md`, but only if that JSON is never rendered as raw
  HTML. Verify nothing downstream uses `dangerouslySetInnerHTML` on note
  content, and sanitize on render regardless (defense in depth, not just
  format choice) — especially once the image extension is in play (watch
  for `javascript:`/`data:` URLs in image `src`).
- **Auth hardening.** Rate limiting on login/signup (nothing currently
  stops credential stuffing or brute force), cookie flags on the
  Supabase auth session (`Secure`, `HttpOnly`, `SameSite`), and CSRF
  posture on the Stripe checkout/portal `<form method="POST">`s
  specifically, since those are real money-moving actions.
- **Security headers.** CSP, `X-Frame-Options`,
  `Strict-Transport-Security`, `X-Content-Type-Options` aren't configured
  anywhere yet; straightforward to add via `next.config`/`proxy.ts` and
  meaningfully reduces clickjacking/injection blast radius for free.
- **Data lifecycle / privacy.** Does deleting an account actually
  cascade-delete the Supabase Auth user, their boards/nodes/edges, and
  get reflected to Stripe (customer/subscription)? Untested today —
  worth an explicit account-deletion audit before real users' financial
  data is attached to this.
- **Desktop track, later.** D7's auto-updater needs signed release
  verification (an unverified update feed is a supply-chain attack
  vector), and D8's custom URL scheme for magic-link deep-linking is a
  known abuse vector (URL scheme hijacking) worth threat-modeling before
  it ships.

Pick these up opportunistically — RLS policy tests first, since it's the
one item that protects every other phase's data, then whichever else
becomes relevant as the phase currently in progress touches that area
(auth hardening around Phase 10/11, security headers any time, desktop
items only once the desktop track actually starts).

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

---

# NoteMap Desktop — Roadmap

A separate, parallel track for wrapping the web app as a native-feeling
desktop app (macOS, Windows, Linux) via Tauri. This does not replace or
fork the web app — the Next.js/Supabase codebase in `/app`, `/components`,
`/lib` stays the single source of truth. Desktop work lives in its own
`src-tauri/` directory inside the same repo, versioned alongside the app
it wraps.

These phases are independent of Phases 9-15 above and can be picked up
at any point once the web app is stable enough to be worth shipping as a
standalone app — there's no hard dependency either direction, though
sharing (Phase 10) and offline-friendly billing (Phase 9) are worth
having before a wide desktop release, not before starting development.

## Phase status

- [ ] **D1 — Tauri scaffold (thin shell).** `npx tauri init` inside the
      existing repo. `tauri.conf.json` points `frontendDist` at the live
      deployed URL (Vercel) — no frontend code changes. Window sizing,
      title, and app identifier configured. Runs and authenticates
      identically to the web app, since nothing about the app itself has
      changed; this phase proves the wrapper, nothing more.
- [ ] **D2 — Branding & icons.** Full `icons/` set generated from a source
      app icon (`.icns` for macOS, `.ico` for Windows, PNGs for Linux) via
      the Tauri CLI icon command. App name, identifier
      (`com.yourdomain.notemap` — pending the rename discussed
      separately), and window chrome finalized.
- [ ] **D3 — macOS universal build.** `rustup target add
      x86_64-apple-darwin aarch64-apple-darwin`, then
      `tauri build --target universal-apple-darwin` to produce one
      `.dmg`/`.app` covering both Apple Silicon and Intel. Code signing
      and notarization configured in `tauri.conf.json`'s
      `bundle.macOS` block (requires an Apple Developer account).
- [ ] **D4 — Windows build.** `tauri build --target
      x86_64-pc-windows-msvc` producing `.msi`/NSIS `.exe`. Decide and
      configure whether the WebView2 runtime is bundled with the
      installer or assumed present (pre-installed on current Windows
      10/11, not guaranteed on older Windows 10 builds). Windows
      code-signing cert obtained if avoiding SmartScreen warnings on
      first run matters for this release.
- [ ] **D5 — Linux build.** `tauri build --target
      x86_64-unknown-linux-gnu` producing `.deb`/`.AppImage`. Verify
      WebKitGTK-based rendering matches the macOS/Windows experience
      closely enough — this is the platform most likely to need visual
      QA passes given the different WebView engine.
- [ ] **D6 — CI release pipeline.** GitHub Actions workflow (Tauri's
      official action) building all three platforms in parallel on a
      tagged release, producing signed installers for macOS, Windows,
      and Linux from one trigger. Removes the need for a physical
      Windows/Linux machine to cut a release.
- [ ] **D7 — Auto-updates.** Tauri's official updater plugin wired in,
      with a release feed the app checks on launch. Deliberately sequenced
      before wide distribution, not after — retrofitting auto-update into
      an already-distributed app means the first version can never
      self-update.
- [ ] **D8 — Bundled/offline shell (stretch).** Revisit D1's thin-shell
      approach in favor of a static export bundled inside the app, if
      offline app-shell startup or reduced network dependency becomes a
      priority. Requires: `output: 'export'` in `next.config`,
      `images.unoptimized`, converting `proxy.ts` route protection to a
      client-side session check (static export has no middleware/server),
      collapsing `/board/[boardId]` to a single static route reading the
      board ID client-side instead of from the path, and a registered
      custom URL scheme (e.g. `notemap://`) so Supabase auth magic-link
      emails can deep-link back into the app window. Not required for D1-D7
      to ship — the live-URL shell is a complete, valid product on its own.

## Notes on the desktop track

D1-D3 get you a real, distributable Mac app quickly and are the natural
first slice — matches the platform already being developed on. D4-D5
extend to Windows/Linux once the shell approach is proven on one
platform, rather than debugging three WebView engines simultaneously.
D6-D7 are about not having to do releases by hand forever, and are worth
doing before, not after, the first public release goes out to real
users. D8 is explicitly optional and only worth revisiting if a concrete
need (offline use, faster cold start, less reliance on the hosted URL
being up) shows up later — the thin-shell approach in D1 is not a
stopgap, it's a legitimate end state if nothing forces a change.

## Git convention

```
feat: scaffold Tauri desktop shell               (D1)
feat: add desktop app icons and branding          (D2)
feat: add macOS universal build + signing         (D3)
feat: add Windows build + WebView2 handling       (D4)
feat: add Linux build                             (D5)
ci: add multi-platform release pipeline           (D6)
feat: add desktop auto-updates                    (D7)
feat: convert desktop shell to bundled static app (D8)
```

Commits are suggested at the end of each phase along with what to test
first — not made automatically.
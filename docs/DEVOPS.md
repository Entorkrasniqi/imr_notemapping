# NoteMap — DevOps

How code gets from a laptop to production: the checks that run at each
step, how the web app, database, and Mac app (ScriptumOS) are deployed, and
where every secret lives. Security design is in `SECURITY.md`; this file is
about the machinery that enforces it.

## 1. The pipeline at a glance

| When | What runs | Defined in |
| --- | --- | --- |
| Every commit | Blocks secrets files, scans staged changes for keys, lints staged code | `.githooks/pre-commit` |
| Every push | Type-check and unit tests | `.githooks/pre-push` |
| Every push and pull request | Lint, types, unit tests, production build, smoke test, database security tests, secret scan, dependency audit | `.github/workflows/ci.yml` |
| Changes under `macos/` | Mac app tests and a universal Release build | `.github/workflows/mac.yml` |
| Merge to `master` | Vercel deploys the web app; new migrations are applied to production | Vercel Git integration, `.github/workflows/deploy-database.yml` |
| Tag `mac-v*` | Signed (when configured), universal Mac app attached to a GitHub Release | `.github/workflows/release-mac.yml` |
| Weekly | Dependency update pull requests | `.github/dependabot.yml` |

Nothing reaches production without passing CI first, as long as branch
protection is on (§8).

## 2. Working locally

| Command | What it does |
| --- | --- |
| `npm run check` | Lint + type-check + unit tests — what the pre-push hook and CI's first steps run |
| `npm test` / `npm run test:watch` | Unit tests (Vitest) |
| `npm run test:db` | Applies every migration to a throwaway Postgres and runs the security tests (§4) |
| `npm run build && npm start`, then `npm run test:smoke` | End-to-end smoke test against a production build |
| `npm run test:mac` | Mac app tests (needs Xcode) |
| `sh macos/scripts/install.sh` | Builds ScriptumOS and installs it in Applications and on the Desktop |

### Git hooks

`npm install` points git at `.githooks/` (the `prepare` script sets
`core.hooksPath`), so the hooks are active in every clone without extra
setup.

- **pre-commit** refuses `.env*`, `Supabase.xcconfig`, and certificate/key
  files even if they were force-added past `.gitignore`; runs `gitleaks` on
  the staged changes (install with `brew install gitleaks` — without it the
  hook warns and CI still scans); and lints the staged JS/TS with zero
  warnings allowed.
- **pre-push** runs the type-check and unit tests.

Either can be skipped once with `--no-verify`. CI runs the same checks, so
skipping only moves the failure later, never past it.

## 3. Continuous integration

`ci.yml` runs four jobs in parallel on every push and pull request:

| Job | Catches |
| --- | --- |
| **web** | Lint and type errors, failing unit tests, a broken production build, and — via the smoke test — pages reachable without login, scripts missing their CSP nonce, missing security headers, an unreachable Stripe webhook, billing routes accepting cross-site posts |
| **database** | A migration that doesn't apply cleanly to Supabase's real Postgres image, and any Row Level Security hole covered by `tests/db/rls.test.sql` |
| **secrets** | A key or token anywhere in the git history (`gitleaks`, full history) |
| **audit** | A known high/critical vulnerability in a production dependency |

The web job builds with placeholder credentials; neither the build nor the
smoke test talks to a real Supabase project or Stripe account.

`mac.yml` runs only when something under `macos/` changes, because macOS
runners cost ten times as much as Linux ones. It runs the XCTest suite and
fails if the Release build isn't universal (Intel + Apple Silicon).

## 4. Tests

### Unit tests — Vitest (`*.test.ts`)

Run in Node, no browser, no network, well under a second.

| File | Covers |
| --- | --- |
| `proxy.test.ts` | Login redirects, a fresh CSP nonce per page, refreshed session cookies surviving redirects, and the Stripe webhook staying outside the login redirect (a regression test — it used to be caught by it) |
| `lib/security/headers.test.ts` | The exact Content-Security-Policy and security headers |
| `lib/security/same-origin.test.ts` | The billing routes' cross-site request check |
| `app/api/stripe/webhook/route.test.ts` | Forged or unsigned Stripe events are rejected and change nothing; real events set the plan correctly |
| `lib/supabase/board-sync.test.ts` | Save ordering (deletes before upserts, notes before edges), "not found" vs "not yours", the free-plan error, row mapping |

Server-only modules import `server-only`, which throws outside a Next.js
server build; `vitest.config.mts` swaps in an empty stand-in for tests.

### Database security tests — `tests/db/rls.test.sql`

The most important tests in the project: Row Level Security is the one
boundary between users' data (see `SECURITY.md` §2), and the app's own
queries never try to cross it, so nothing else would notice a hole.

The file signs in as test users by setting the same JWT claims and
database roles (`authenticated`, `anon`) that Supabase's API uses, then
tries every cross-user read and write it can: listing, reading by id,
editing, deleting, moving rows into another user's board, connecting to
another user's notes, upgrading its own plan, creating a fourth free
board. Each attempt must be refused. Everything runs in one transaction
that's rolled back.

`npm run test:db` needs no Docker: it starts a throwaway PostgreSQL in a
temp directory, adds a small stand-in for Supabase's `auth` schema
(`tests/db/supabase-shim.sql`), applies every migration, runs the tests,
and deletes it all. CI runs the same file against the real Supabase
Postgres image instead (`supabase db start`). To run it against a local
Supabase stack yourself:

```sh
supabase db start
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db
```

Never point it at production — it writes (then rolls back) test users.

**When adding a table or policy**, add its attacks here first. Phase 10
(sharing) changes the policies from "owner only" to "owner or member" —
exactly the kind of change these tests exist for.

### Smoke test — `scripts/smoke.mjs`

Runs against a production build (`npm start`) as a signed-out visitor and
checks what's visible from outside: the login page renders, every script
tag carries the response's CSP nonce, security headers are present and
`X-Powered-By` isn't, protected pages redirect to `/login`, the Stripe
webhook answers (with a signature error) instead of redirecting, and the
billing routes refuse cross-site posts but still require a login.

### Mac app — XCTest (`macos/NoteMapTests/`)

Tiptap JSON round-trips, editor commands, React Flow edge-routing parity,
and row mapping — see `macos/README.md`. The fixtures are checked against
the web app's real Tiptap schema with
`node --experimental-strip-types --no-warnings macos/scripts/check-tiptap-fixtures.mjs`.

## 5. Deploying the web app and the database

### Web app — Vercel

Vercel's Git integration builds every pull request as a preview deployment
and deploys `master` to production. There's no deploy workflow in this
repository for the web app; branch protection (§8) is what ensures only
code that passed CI reaches `master`.

### Database — `deploy-database.yml`

When a push to `master` changes `supabase/migrations/`, this workflow:

1. runs the database tests against the new migrations,
2. waits for approval if the `production` environment has required
   reviewers,
3. prints the migrations about to be applied (`supabase db push --dry-run`),
4. applies them (`supabase db push`).

It can also be run by hand from the Actions tab.

### Rules for migrations

- **Never edit a migration that has been applied.** Write a new one.
- **Keep every migration backward-compatible with the running app.**
  Vercel and the migration workflow deploy from the same push in parallel,
  so for a minute either can be ahead of the other. Add first, switch the
  code over, remove later (expand/contract): a column rename is three
  deploys, not one.
- **Rolling back** the web app is instant in Vercel. The database has no
  automatic rollback: undo a change with a new migration.

## 6. Releasing the Mac app

Push a tag to build a release:

```sh
git tag mac-v1.0.0 && git push origin mac-v1.0.0
```

`release-mac.yml` writes the Supabase config from secrets, archives a
universal build, and — when the Developer ID secrets exist — signs it,
notarizes it with Apple, and staples the ticket. The zip is attached to a
GitHub Release.

Without the signing secrets the release is still built but unsigned, and
macOS makes each tester approve it once (System Settings → Privacy &
Security → Open Anyway). Signing needs a paid Apple Developer account.

## 7. Secrets and configuration

| Secret or variable | Lives in | Used by |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel (all environments), `.env.local` | Web app (public by design) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (production, preview), `.env.local` | Stripe routes only — bypasses RLS |
| `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | Vercel — live keys for production, test keys for preview | Stripe routes |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` | GitHub, `production` environment | `deploy-database.yml` |
| `MAC_SUPABASE_URL`, `MAC_SUPABASE_ANON_KEY` (secrets), `MAC_WEB_URL` (variable) | GitHub, `release` environment | `release-mac.yml` |
| `DEVELOPER_ID_P12`, `DEVELOPER_ID_P12_PASSWORD`, `APPLE_TEAM_ID`, `APPLE_ID`, `APPLE_APP_PASSWORD` | GitHub, `release` environment | `release-mac.yml` (optional) |
| Supabase URL + anon key for local Mac builds | `macos/Config/Supabase.xcconfig` (gitignored) | Xcode builds |

`.env.local` and `macos/Config/Supabase.xcconfig` are gitignored, blocked by
the pre-commit hook, and covered by CI's history scan. Rotation steps are in
`SECURITY.md` §4.

`DEVELOPER_ID_P12` is the Developer ID Application certificate exported
from Keychain Access as a `.p12`, base64-encoded (`base64 -i cert.p12 |
pbcopy`). `APPLE_APP_PASSWORD` is an app-specific password from
appleid.apple.com, not the Apple ID password.

## 8. One-time setup

1. **Push to GitHub.** CI runs on the first push.
2. **Protect `master`** (Settings → Branches): require pull requests and the
   `web`, `database`, `secrets`, and `audit` checks to pass.
3. **Create a `production` environment** (Settings → Environments), add
   yourself as a required reviewer, and add the three `SUPABASE_*` secrets
   from §7. The access token comes from supabase.com/dashboard/account/tokens.
4. **Create a `release` environment** with the Mac secrets from §7 (the
   signing ones can wait until there's an Apple Developer account).
5. **Turn on GitHub's security features** (Settings → Code security): secret
   scanning with push protection, Dependabot alerts, and private
   vulnerability reporting.
6. **Vercel**: confirm the Git integration, set the variables from §7 per
   environment, and give preview deployments Stripe *test* keys only.
7. **Stripe**: after deploying, send a test event to the
   `/api/stripe/webhook` endpoint from the Stripe dashboard and confirm it
   answers `200` (see `SECURITY.md` §6, issue 1).
8. **Supabase Auth settings**: see `SECURITY.md` §7.

## 9. Not covered yet

- **Monitoring and alerting.** Nothing yet alerts on errors or on failed
  Stripe webhooks — Stripe's dashboard shows delivery failures, but only if
  someone looks. Sentry (or Vercel's log drains) plus a Stripe webhook
  failure email is the next step.
- **Backups.** Confirm Supabase's backup schedule on the current plan and
  do one test restore.
- **Staging.** One Supabase project serves both preview deployments and
  production. A second project for previews would keep test data out of
  production.
- **Signed-in end-to-end tests.** The smoke test only sees what a signed-out
  visitor sees. Playwright tests with a dedicated test account would cover
  the dashboard and canvas.
- **Pinned actions.** Workflows use major-version tags (`@v4`); pinning to
  commit SHAs (Dependabot keeps them current) guards against a compromised
  action tag.

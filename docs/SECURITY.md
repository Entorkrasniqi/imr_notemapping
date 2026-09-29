# NoteMap — Security

What NoteMap protects, what it protects it against, how each defense
works, and what's still open. Covers the web app, the database, and the
Mac app (ScriptumOS). How these defenses are tested and deployed is in
`DEVOPS.md`.

Found a vulnerability? See §10 — please don't open a public issue.

## 1. Threat model

**What's worth protecting:** each user's boards and notes, their account,
and their billing state (a free user shouldn't be able to make themselves
Pro).

**Who might attack it:**

| Attacker | Can | Main defense |
| --- | --- | --- |
| Another signed-in user | Call the Supabase API directly with their own valid token, with any query they like — not just the app's | Row Level Security (§2) |
| Anyone on the internet | Call the API and the app's routes without an account | RLS, the login redirect in `proxy.ts`, signature checks (§5) |
| A malicious website | Make a visitor's browser send requests to NoteMap, or frame it | SameSite cookies, the Origin check, `frame-ancestors` (§3, §5) |
| Injected script (via some future bug) | Run in NoteMap's pages and read the session | Content-Security-Policy (§3) |
| Someone who gets a secret | Use a leaked key | Key placement rules, scanning, rotation (§4) |

**Trust boundaries.** The browser and the Mac app talk to Supabase
*directly*: every read and write of boards, notes, and edges goes straight
from the client to Supabase's API with the user's token. There's no
NoteMap server in between to enforce rules. **The database is the security
boundary** — anything its policies allow, any user can do, whatever the UI
shows. The Next.js server only handles login redirects and the three
Stripe routes.

## 2. Data access: Row Level Security

Every table has RLS on. The policies (from `supabase/migrations/`):

| Table | Who can read | Who can write |
| --- | --- | --- |
| `boards` | Owner | Owner; `user_id` is set by Postgres from the token, and can't be changed to someone else |
| `nodes` | Owner of the board | Owner of the board; a note can't be moved into someone else's board |
| `edges` | Owner of the board | Owner of the board, and both notes must be on that same board |
| `profiles` | Only your own row | Nobody through the API — `plan` changes only via the Stripe webhook (service role) |

Enforced in the database, not in the app:

- **Free-plan limit** — a trigger rejects a fourth board on the free plan,
  serialized per user so concurrent requests can't slip past it.
- **Same-board edges** — composite foreign keys (added 2026-09-29, §6).
- **Board name length** — 1 to 200 characters.

**Tested** by `tests/db/rls.test.sql`, which acts as other users and as an
anonymous visitor and tries every cross-user read and write — in CI on
every push, and before every production migration. Run it with
`npm run test:db`.

**Rules for new tables:** enable RLS in the same migration that creates
the table, write the policy, and add the attacks against it to
`rls.test.sql` before merging. A table without RLS is readable by anyone
with the public anon key.

## 3. Browser hardening

### Content-Security-Policy

Set per request in `proxy.ts`, built in `lib/security/headers.ts`:

| Directive | Value | Why |
| --- | --- | --- |
| `script-src` | `'self' 'nonce-…' 'strict-dynamic'` | Only scripts carrying this response's random nonce run. An injected `<script>` or `onerror=` handler doesn't. This matters because the Supabase session cookie is readable by JavaScript (`@supabase/ssr` needs that), so script injection would mean session theft. |
| `style-src` | `'self' 'unsafe-inline'` | React Flow positions every note with inline styles, and note previews carry Tiptap's inline colors. Nonces don't apply to style attributes, so this can't be stricter without breaking the canvas. Styles can't run code. |
| `img-src` | `'self' data: blob:` | Images embedded in notes. Remote images are blocked, so pasted content can't load tracking pixels. |
| `connect-src` | `'self'` + the Supabase project (`https`/`wss`) | Where the page may send data. |
| `form-action` | `'self'` + Stripe Checkout/Billing | Browsers apply this to redirects after a form post, and the billing forms end up at Stripe. |
| `frame-ancestors` | `'none'` | Can't be framed (clickjacking). |
| `object-src`, `base-uri` | `'none'`, `'self'` | No plugins; no `<base>` tag redirecting relative URLs. |

A per-request nonce means pages render per request rather than from a
static cache — `app/layout.tsx` reads the request headers, which makes that
so. For an app where every page is behind a login, that costs nothing.

### Other headers

Set on every response in `next.config.ts`: `Strict-Transport-Security`
(HTTPS only, two years), `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`
(board URLs contain board ids), `Permissions-Policy` denying camera,
microphone, geolocation, payment and USB, and
`Cross-Origin-Opener-Policy: same-origin`. `X-Powered-By` is off.

### Rich text

Notes are stored as Tiptap JSON, not HTML. The canvas renders a note's
title with Tiptap's `generateHTML`, which escapes text and drops
`javascript:` links. The CSP above stops anything that got through anyway.

## 4. Secrets

| Secret | Sensitivity | May live in |
| --- | --- | --- |
| Supabase URL, anon key | Public by design — RLS protects the data | Browser bundle, Mac app, `NEXT_PUBLIC_*` |
| Supabase service role key | **Full database access, bypasses RLS** | Vercel server env, `.env.local` — nowhere else |
| Stripe secret key | Charges and refunds | Vercel server env, `.env.local` |
| Stripe webhook secret | Lets someone forge plan changes | Vercel server env, `.env.local` |
| Supabase access token, DB password | Deploy migrations | GitHub `production` environment |
| Apple signing certificate and passwords | Sign apps as you | GitHub `release` environment |

How they're kept in place:

- `lib/supabase/admin.ts`, `lib/stripe/client.ts`, and
  `lib/supabase/server.ts` import `server-only`, so the build fails if
  browser code ever imports them.
- Nothing secret uses a `NEXT_PUBLIC_` name; only public values are bundled.
- `.env*` and `macos/Config/Supabase.xcconfig` are gitignored, refused by
  the pre-commit hook, and CI scans the full git history with gitleaks. The
  history was clean when scanning started (2026-09-29).

**Rotating a key** — do it at once if a key may have leaked (a commit, a
screenshot, a log), then work out how it happened:

- *Service role key*: Supabase dashboard → Project Settings → API → roll
  the key; update Vercel and `.env.local`; redeploy.
- *Stripe secret key*: Stripe dashboard → Developers → API keys → roll;
  update Vercel; redeploy.
- *Stripe webhook secret*: roll it on the webhook endpoint in Stripe;
  update `STRIPE_WEBHOOK_SECRET` in Vercel; redeploy; send a test event.

Removing a key from git history does not make it safe again — rotate it.

## 5. Billing endpoints

- **Checkout and portal** (`/api/stripe/checkout`, `/portal`) are POST-only.
  Before anything else they check that the `Origin` header is NoteMap's own,
  so another website can't start a checkout or open the billing portal in a
  visitor's name. They then check the login themselves, not through
  `proxy.ts`. The session cookie is also `SameSite=Lax`, which keeps
  cross-site POSTs from carrying it.
- **Webhook** (`/api/stripe/webhook`) has no session — Stripe calls it
  directly — so identity comes from the signature on the payload, verified
  with `STRIPE_WEBHOOK_SECRET` before anything is read. Unsigned or forged
  events get `400` and change nothing (unit-tested). `proxy.ts` excludes
  this route from the login redirect, and the smoke test checks it stays
  reachable.

## 6. Issues found and fixed — 2026-09-29

| # | Issue | Impact | Fix | Tested by |
| --- | --- | --- | --- | --- |
| 1 | The login redirect in `proxy.ts` also ran on `/api/stripe/webhook`, answering every Stripe event with `307 → /login` | **Upgrades never reached the database**: paying users stayed on the free plan, and cancellations never downgraded anyone | Webhook excluded from the proxy matcher | `proxy.test.ts`, smoke test |
| 2 | No security headers or CSP | Injected script could run and read the session; the app could be framed | §3 | `headers.test.ts`, smoke test, headless browser check |
| 3 | An edge could reference another user's notes | Cross-user references, and a "does this id exist?" oracle | Composite foreign keys | `rls.test.sql` (fails on the old schema) |
| 4 | The free-plan limit could be raced by concurrent requests | Free users could get more than three boards | Per-user advisory lock in the trigger | — (needs two concurrent sessions) |
| 5 | Responses carrying a refreshed session cookie didn't send `Cache-Control: no-store` | A CDN could cache one user's session and serve it to another | `proxy.ts` applies the headers `@supabase/ssr` provides | `proxy.test.ts` |
| 6 | A refreshed session cookie was dropped whenever `proxy.ts` redirected | Extra refreshes, and possibly spurious logouts | Cookies applied to every response | `proxy.test.ts` |
| 7 | The billing routes relied only on `SameSite` against cross-site requests | Weaker request-forgery protection | Origin check (§5) | `same-origin.test.ts`, smoke test |
| 8 | Minimum password length was 6 | Weaker passwords | 8, in the web app, the Mac app, and local config | — |

Issue 1 isn't a vulnerability as such, but it broke the one path that
keeps billing and access in sync. After deploying, send a test event from
the Stripe dashboard to confirm the webhook answers `200` (`DEVOPS.md` §8).

## 7. Production settings to check

These live in dashboards, not in this repository, so only the owner can
set them:

**Supabase → Authentication**
- [ ] Confirm email: **on** (it's off locally for convenience; the signup
      page already handles the "check your email" case).
- [ ] Minimum password length: **8**, to match the apps.
- [ ] Leaked password protection (HaveIBeenPwned): **on** (Pro plan).
- [ ] Anonymous sign-ins: **off**. Phase 5 used them; each anonymous user
      would get three free boards.
- [ ] Site URL and redirect URLs: production domain only (plus `localhost`
      if needed) — this is what stops open redirects in auth emails.
- [ ] Rate limits for sign-ins and sign-ups: reviewed.

**Supabase → Database**
- [ ] SSL enforcement: **on**.
- [ ] Security Advisor: no warnings.

**Stripe**
- [ ] Separate webhook signing secrets for test and live.
- [ ] Two-factor authentication on the account.

**Vercel**
- [ ] Preview deployments use Stripe *test* keys, never live ones.
- [ ] Deployment protection on for previews.

**GitHub**
- [ ] Two-factor authentication, branch protection, secret scanning with
      push protection, and private vulnerability reporting (`DEVOPS.md` §8).

## 8. The Mac app (ScriptumOS)

- **Session storage**: in the login Keychain, not in preferences or files.
  Signing out revokes the session on the server and deletes it locally.
- **Sandbox**: App Sandbox on, with only outgoing network access and
  read-only access to files the user drops in. Hardened Runtime on.
- **Keys**: only the public anon key is built in; it has no more access
  than the web app's. RLS applies exactly as in the browser.
- **Content**: note images are decoded only from `data:` URLs already in
  the note; the app never fetches a URL found in note content.
- **Distribution**: builds you make yourself are signed "to run locally".
  Anything given to other people should be signed with a Developer ID and
  notarized (`DEVOPS.md` §6), so macOS can verify it hasn't been tampered
  with.

## 9. Known gaps

- **Storage quotas.** Images are stored inside note JSON with no per-user
  cap on note size or count. Moving images to Supabase Storage with size
  limits and per-user quotas would close this and speed up saves.
- **Account deletion** — deleting a user in Supabase cascades to their
  data, but nothing cancels their Stripe subscription, and there's no
  self-service deletion.
- **Two-factor authentication** is available in Supabase Auth but not
  offered in the apps.
- **Audit log** — there's no record of who changed what, which would matter
  once boards are shared.
- **Sharing (Phase 10)** changes the policies from "owner only" to "owner or
  member". Extend `rls.test.sql` with the new attacks before writing the
  new policies.

## 10. Reporting a vulnerability

Please report it privately through GitHub's private vulnerability
reporting (the repository's **Security** tab → **Report a vulnerability**),
not in a public issue. Include what you found, how to reproduce it, and
what it lets an attacker do. You'll get an acknowledgement within a few
days.

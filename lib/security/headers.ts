/**
 * HTTP security headers — see docs/SECURITY.md §3 for the threat each one
 * addresses. Kept as plain functions/data (no Next.js imports) so the exact
 * policy is unit-tested (`lib/security/headers.test.ts`) and can't drift
 * silently.
 */

type CspOptions = {
  /** Fresh per request, from `proxy.ts` — see `createNonce`. */
  nonce: string;
  isDev: boolean;
  /** `NEXT_PUBLIC_SUPABASE_URL` — the one API origin the browser talks to. */
  supabaseUrl?: string;
};

/**
 * Stripe's hosted pages. The "Upgrade to Pro"/"Manage billing" forms POST
 * to our own route, which then redirects to one of these — and browsers
 * apply `form-action` to where a form submission *ends up* after
 * redirects, not just where it's first sent. Without these, checkout would
 * be blocked by our own policy.
 */
const STRIPE_FORM_TARGETS = ["https://checkout.stripe.com", "https://billing.stripe.com"];

/**
 * The Content-Security-Policy for every page.
 *
 * Scripts: only ones carrying this request's nonce (Next.js applies it to
 * its own scripts automatically; `app/layout.tsx` applies it to the one
 * inline theme script), plus whatever those load (`'strict-dynamic'`).
 * That's what makes an injected `<script>` or `onerror=` handler inert,
 * even if some future bug let one into the page.
 *
 * Styles stay `'unsafe-inline'` on purpose: React Flow positions every
 * node with inline `style` attributes, and note previews carry Tiptap's
 * inline colors — nonces don't apply to style attributes, so a strict
 * `style-src` would break the canvas. Inline styles can't run code.
 *
 * Images: `data:`/`blob:` for images embedded in notes; remote images are
 * deliberately not allowed (no tracking pixels via pasted note content).
 */
export function buildContentSecurityPolicy({ nonce, isDev, supabaseUrl }: CspOptions): string {
  const connectSrc = ["'self'"];
  if (supabaseUrl) {
    const url = new URL(supabaseUrl);
    connectSrc.push(url.origin, `${url.protocol === "https:" ? "wss" : "ws"}://${url.host}`);
  }

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // React needs eval only for dev-mode error overlays, never in production.
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": connectSrc,
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", ...STRIPE_FORM_TARGETS],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  // Only over real HTTPS — upgrading requests on `http://localhost` would
  // break local development.
  if (!isDev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/** An unguessable, single-use value for the CSP `nonce-…` source. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Static headers for every response, pages and API routes alike (applied
 * in `next.config.ts`). The CSP is separate because it needs a per-request
 * nonce, which only `proxy.ts` can generate.
 */
export const STATIC_SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  // HTTPS only, for two years, on every subdomain. Browsers ignore this
  // header over plain http, so local development is unaffected.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Don't guess content types — an uploaded "image" can't be run as script.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Never render inside someone else's frame (clickjacking). The CSP's
  // `frame-ancestors 'none'` does the same for current browsers.
  { key: "X-Frame-Options", value: "DENY" },
  // Board URLs contain board ids — only ever send the bare origin to
  // other sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing in NoteMap needs these; deny them outright.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  // No other window we open can reach back into ours.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

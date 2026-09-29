import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { buildContentSecurityPolicy, createNonce } from "@/lib/security/headers";

// `middleware.ts` was renamed to `proxy.ts` in Next.js 16 — same file
// conventions and runtime, different name and export. See
// node_modules/next/dist/docs/.../proxy.md for the full migration note;
// worth knowing if you've seen the old name in older tutorials/examples.

// The only pages a signed-out visitor is allowed to see.
const PUBLIC_PATHS = ["/login", "/signup"];

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Runs before every page request and decides, at the network edge, whether
 * it's allowed to proceed — this is what "protected routes" actually means
 * here, not a client-side check that merely hides the UI while still
 * fetching data underneath. It also refreshes the session cookie on every
 * request, which `@supabase/ssr` requires: without this, sessions would
 * silently expire mid-visit instead of auto-refreshing.
 *
 * It also sets the page's Content-Security-Policy, with a nonce generated
 * fresh for this request (see `lib/security/headers.ts` and
 * docs/SECURITY.md §3) — only proxy can do that, since a nonce has to be
 * unique per response.
 */
export async function proxy(request: NextRequest) {
  // Whatever Supabase asks to set while refreshing the session. Collected
  // here and applied to whichever response is returned below — redirects
  // included, which used to drop a refreshed cookie on the floor.
  const cookiesToSet: CookieToSet[] = [];
  const cacheHeaders: Record<string, string> = {};

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookies, headers) {
          // Cookies have to be written to *both* sides: the request (so
          // this same proxy invocation's own `supabase` client sees the
          // refreshed session immediately) and the response (so the
          // browser actually receives the updated cookie).
          for (const { name, value } of cookies) {
            request.cookies.set(name, value);
          }
          cookiesToSet.push(...cookies);
          // `Cache-Control: no-store` and friends: a response carrying a
          // fresh session cookie must never be cached by a CDN and served
          // to someone else.
          Object.assign(cacheHeaders, headers);
        },
      },
    },
  );

  // `getUser()`, not `getSession()`: `getSession()` just reads whatever
  // the cookie currently says, unverified. `getUser()` revalidates the
  // token against Supabase's own auth server. That distinction only
  // matters for a gatekeeping decision like this one — the browser client
  // elsewhere in the app (lib/supabase/board-sync.ts) uses `getSession()`
  // for its own, already-trusted session, which is a different situation.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.includes(request.nextUrl.pathname);
  // API routes make their own decision (the billing routes check the
  // request's origin first, then the user) and answer with a status code,
  // not a page redirect — proxy only keeps their session fresh.
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");

  let response: NextResponse;
  if (isApiRoute) {
    response = NextResponse.next({ request });
  } else if (!user && !isPublicPath) {
    response = redirectTo(request, "/login");
  } else if (user && isPublicPath) {
    response = redirectTo(request, "/");
  } else {
    const nonce = createNonce();
    const csp = buildContentSecurityPolicy({
      nonce,
      isDev: process.env.NODE_ENV === "development",
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });
    // Next.js reads the nonce back out of the *request's* CSP header while
    // rendering and stamps it on its own scripts; `app/layout.tsx` reads
    // `x-nonce` for the one inline script of ours.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
    response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", csp);
  }

  for (const { name, value, options } of cookiesToSet) {
    response.cookies.set(name, value, options);
  }
  for (const [key, value] of Object.entries(cacheHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except static assets and image optimization files — those
  // never need an auth check, and running proxy on them anyway would just
  // slow down every page load for no benefit.
  //
  // Also except the Stripe webhook: Stripe calls it server-to-server, with
  // no session cookie, and authenticates by signing the payload instead
  // (verified in the route itself). Running the login redirect on it used
  // to answer every Stripe event with `307 → /login`, so no plan change
  // ever reached `profiles` — see docs/SECURITY.md §6.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook).*)"],
};

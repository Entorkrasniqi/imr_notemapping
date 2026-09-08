import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// `middleware.ts` was renamed to `proxy.ts` in Next.js 16 — same file
// conventions and runtime, different name and export. See
// node_modules/next/dist/docs/.../proxy.md for the full migration note;
// worth knowing if you've seen the old name in older tutorials/examples.

// The only pages a signed-out visitor is allowed to see.
const PUBLIC_PATHS = ["/login", "/signup"];

/**
 * Runs before every page request and decides, at the network edge, whether
 * it's allowed to proceed — this is what "protected routes" actually means
 * here, not a client-side check that merely hides the UI while still
 * fetching data underneath. It also refreshes the session cookie on every
 * request, which `@supabase/ssr` requires: without this, sessions would
 * silently expire mid-visit instead of auto-refreshing.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Cookies have to be written to *both* sides: the request (so
          // this same proxy invocation's own `supabase` client sees the
          // refreshed session immediately) and the response (so the
          // browser actually receives the updated cookie).
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
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

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Everything except static assets and image optimization files — those
  // never need an auth check, and running proxy on them anyway would just
  // slow down every page load for no benefit.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

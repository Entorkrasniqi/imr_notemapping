import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * A Supabase client for use in Server Components and Route Handlers.
 *
 * Unlike the browser client (`lib/supabase/client.ts`), this one reads and
 * writes the session through Next.js's own `cookies()` API rather than
 * directly through `document.cookie` — it has to, since there's no `document`
 * on the server. `cookies()` is async in this version of Next.js, which is
 * why this whole function is async too.
 *
 * The `setAll` call is wrapped in a try/catch because Server *Components*
 * (as opposed to Server Actions or Route Handlers) aren't allowed to set
 * cookies at all — Next.js throws if you try. That's fine here specifically
 * because `proxy.ts` already refreshes the session on every request; a
 * Server Component reading a slightly-not-yet-rewritten cookie for the
 * remainder of that one request is harmless.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — see the comment above.
          }
        },
      },
    },
  );
}

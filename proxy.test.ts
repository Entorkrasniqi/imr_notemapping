import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type CookieMethods = {
  setAll: (cookies: { name: string; value: string; options: object }[], headers: Record<string, string>) => void;
};

// Stand-in Supabase: `user` decides who's signed in, and `refresh` lets a
// test simulate the session cookie being refreshed during the request.
let user: { id: string } | null = null;
let refresh = false;
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, { cookies }: { cookies: CookieMethods }) => ({
    auth: {
      getUser: async () => {
        if (refresh) {
          cookies.setAll([{ name: "sb-token", value: "fresh", options: { path: "/" } }], {
            "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
          });
        }
        return { data: { user } };
      },
    },
  }),
}));

const { proxy, config } = await import("./proxy");

beforeEach(() => {
  user = null;
  refresh = false;
});

const get = (path: string) => proxy(new NextRequest(`https://notemap.example${path}`));

describe("proxy", () => {
  it("sends signed-out visitors to /login", async () => {
    const response = await get("/board/123");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://notemap.example/login");
  });

  it("leaves API routes to decide for themselves", async () => {
    const response = await get("/api/stripe/checkout");
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("sends signed-in users away from /login", async () => {
    user = { id: "u1" };
    const response = await get("/login");
    expect(response.headers.get("location")).toBe("https://notemap.example/");
  });

  it("gives every page a fresh nonce-based Content-Security-Policy", async () => {
    user = { id: "u1" };
    const first = (await get("/")).headers.get("content-security-policy");
    const second = (await get("/")).headers.get("content-security-policy");
    expect(first).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(first).not.toEqual(second);
  });

  it("keeps a refreshed session cookie — and no-store headers — even on a redirect", async () => {
    refresh = true;
    const response = await get("/");
    expect(response.status).toBe(307);
    expect(response.cookies.get("sb-token")?.value).toBe("fresh");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  // Regression: the webhook used to be caught by the login redirect, so
  // every Stripe event got `307 → /login` and never reached the handler.
  it("never runs on the Stripe webhook, which Stripe calls without a session", () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    expect(matcher.test("/api/stripe/webhook")).toBe(false);
    expect(matcher.test("/_next/static/chunk.js")).toBe(false);
    for (const path of ["/", "/login", "/board/123", "/api/stripe/checkout", "/api/stripe/portal"]) {
      expect(matcher.test(path)).toBe(true);
    }
  });
});

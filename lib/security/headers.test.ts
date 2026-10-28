import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, createNonce, STATIC_SECURITY_HEADERS } from "./headers";

function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split(";").map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values] as const;
    }),
  );
}

describe("buildContentSecurityPolicy", () => {
  const production = directives(
    buildContentSecurityPolicy({ nonce: "abc123", isDev: false, supabaseUrl: "https://ref.supabase.co" }),
  );

  it("only runs scripts carrying the request's nonce", () => {
    const scripts = production.get("script-src")!;
    expect(scripts).toContain("'nonce-abc123'");
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
  });

  it("allows eval only in development", () => {
    const dev = directives(buildContentSecurityPolicy({ nonce: "n", isDev: true }));
    expect(dev.get("script-src")).toContain("'unsafe-eval'");
    expect(dev.has("upgrade-insecure-requests")).toBe(false);
    expect(production.has("upgrade-insecure-requests")).toBe(true);
  });

  it("forbids framing, plugins, and base-tag hijacking", () => {
    expect(production.get("frame-ancestors")).toEqual(["'none'"]);
    expect(production.get("object-src")).toEqual(["'none'"]);
    expect(production.get("base-uri")).toEqual(["'self'"]);
  });

  it("lets the billing forms reach Stripe and nowhere else", () => {
    expect(production.get("form-action")).toEqual([
      "'self'",
      "https://checkout.stripe.com",
      "https://billing.stripe.com",
    ]);
  });

  it("lets the PDF reader start its worker, from our own origin only", () => {
    expect(production.get("worker-src")).toEqual(["'self'", "blob:"]);
  });

  it("only talks to our own origin and the Supabase project", () => {
    expect(production.get("connect-src")).toEqual(["'self'", "https://ref.supabase.co", "wss://ref.supabase.co"]);
    expect(production.get("img-src")).toEqual(["'self'", "data:", "blob:"]);
  });
});

describe("createNonce", () => {
  it("is fresh and unguessable every time", () => {
    const nonces = new Set(Array.from({ length: 50 }, createNonce));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) expect(atob(nonce)).toHaveLength(16);
  });
});

describe("STATIC_SECURITY_HEADERS", () => {
  it("includes the baseline hardening headers", () => {
    const names = STATIC_SECURITY_HEADERS.map((header) => header.key);
    expect(names).toEqual(
      expect.arrayContaining([
        "Strict-Transport-Security",
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Permissions-Policy",
      ]),
    );
  });
});

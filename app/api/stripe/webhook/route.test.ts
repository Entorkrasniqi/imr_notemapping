import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// The only thing this route may do with a verified event is update
// `profiles` — record exactly what it asks for.
const updates: Array<{ values: Record<string, unknown>; column: string; value: unknown }> = [];
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      expect(table).toBe("profiles");
      return {
        update: (values: Record<string, unknown>) => ({
          eq: async (column: string, value: unknown) => {
            updates.push({ values, column, value });
            return { error: null };
          },
        }),
      };
    },
  }),
}));

const WEBHOOK_SECRET = "whsec_test_secret";
let POST: (request: NextRequest) => Promise<Response>;
let sign: (payload: string) => string;

beforeAll(async () => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_unit");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
  ({ POST } = await import("./route"));
  const { stripe } = await import("@/lib/stripe/client");
  sign = (payload) => stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
});

beforeEach(() => {
  updates.length = 0;
});

function webhook(event: object, signature?: string) {
  const payload = JSON.stringify(event);
  return new NextRequest("https://notemap.example/api/stripe/webhook", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": signature ?? sign(payload) },
  });
}

const event = (type: string, object: object) => ({ id: "evt_1", object: "event", type, data: { object } });

describe("Stripe webhook", () => {
  it("rejects an event without a valid signature — and changes nothing", async () => {
    const forged = event("checkout.session.completed", { customer: "cus_1", subscription: "sub_1" });
    const response = await POST(webhook(forged, "t=1,v1=forged"));
    expect(response.status).toBe(400);
    expect(updates).toEqual([]);
  });

  it("rejects a request with no signature header", async () => {
    const request = new NextRequest("https://notemap.example/api/stripe/webhook", { method: "POST", body: "{}" });
    expect((await POST(request)).status).toBe(400);
    expect(updates).toEqual([]);
  });

  it("upgrades the paying customer on a completed checkout", async () => {
    const response = await POST(webhook(event("checkout.session.completed", { customer: "cus_1", subscription: "sub_1" })));
    expect(response.status).toBe(200);
    expect(updates).toEqual([
      { values: { plan: "pro", stripe_subscription_id: "sub_1" }, column: "stripe_customer_id", value: "cus_1" },
    ]);
  });

  it("downgrades when the subscription ends", async () => {
    await POST(webhook(event("customer.subscription.deleted", { id: "sub_1", customer: "cus_1", status: "canceled" })));
    expect(updates).toEqual([
      { values: { plan: "free", stripe_subscription_id: null }, column: "stripe_customer_id", value: "cus_1" },
    ]);
  });

  it("ignores event types it doesn't handle", async () => {
    const response = await POST(webhook(event("invoice.paid", { id: "in_1" })));
    expect(response.status).toBe(200);
    expect(updates).toEqual([]);
  });
});

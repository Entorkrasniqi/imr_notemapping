import type { NextRequest } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Syncs `profiles.plan` from Stripe subscription events. This is the
 * app's first genuinely server-side endpoint that isn't just a redirect —
 * see `docs/architecture.md` §3 — because it's Stripe calling us, not a
 * signed-in browser: there's no session/cookie to trust, so identity
 * instead comes from the verified event payload (the customer id), and
 * writes go through the admin client (see `lib/supabase/admin.ts`) since
 * RLS has nothing to check `auth.uid()` against here.
 *
 * Route Handlers read the body via the Web `Request` API directly (no
 * Pages-Router-style `bodyParser: false` config needed — confirmed against
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`'s
 * own Webhooks example), which is what makes `request.text()` below give
 * the exact raw bytes Stripe signed, required for signature verification.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  const body = await request.text();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("Missing stripe-signature header");
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(`Webhook signature verification failed: ${message}`, {
      status: 400,
    });
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string | null;
      const { error } = await admin
        .from("profiles")
        .update({ plan: "pro", stripe_subscription_id: subscriptionId })
        .eq("stripe_customer_id", customerId);
      if (error) throw error;
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const isActive =
        subscription.status === "active" || subscription.status === "trialing";
      const { error } = await admin
        .from("profiles")
        .update({
          plan: isActive ? "pro" : "free",
          stripe_subscription_id: isActive ? subscription.id : null,
        })
        .eq("stripe_customer_id", customerId);
      if (error) throw error;
      break;
    }

    default:
      break;
  }

  return new Response("OK", { status: 200 });
}

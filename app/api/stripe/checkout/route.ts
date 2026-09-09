import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, STRIPE_PRO_PRICE_ID } from "@/lib/stripe/client";

/**
 * Starts an upgrade-to-Pro purchase. The dashboard's "Upgrade to Pro"
 * button is a plain `<form method="POST">` targeting this route (see
 * `Dashboard.tsx`) rather than a `fetch` + client-side redirect — a
 * Route Handler can `redirect()` straight to Stripe's own URL, so the
 * browser navigates there in one hop with no client JS involved.
 *
 * `getUser()`, not `getSession()`: this decides which real Stripe
 * customer gets billed, so it needs the revalidated identity (see
 * `proxy.ts`'s own comment on this), not just whatever the cookie claims.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();
  if (error) throw error;

  let customerId = profile.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;

    const { error: updateError } = await admin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
    if (updateError) throw updateError;
  }

  const origin = new URL(request.url).origin;
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: STRIPE_PRO_PRICE_ID, quantity: 1 }],
    success_url: `${origin}/?checkout=success`,
    cancel_url: `${origin}/?checkout=cancelled`,
    // Managed Payments (Stripe as merchant of record) needs a tax code on
    // the product, which this app has no use for — plain Stripe billing
    // is enough for a subscription flag on `profiles`.
    managed_payments: { enabled: false },
  });

  if (!checkoutSession.url) {
    throw new Error("Stripe did not return a Checkout URL");
  }
  redirect(checkoutSession.url);
}

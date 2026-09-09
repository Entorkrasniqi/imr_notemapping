import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";

/**
 * Opens Stripe's hosted Customer Portal, where a Pro user can update
 * payment details, view invoices, or cancel — mirrors the checkout
 * route's redirect-based shape (form POST in, `redirect()` straight to
 * Stripe, no client JS).
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

  const customerId = profile.stripe_customer_id as string | null;
  if (!customerId) {
    throw new Error("No Stripe customer on file — nothing to manage yet");
  }

  const origin = new URL(request.url).origin;
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/`,
  });

  redirect(portalSession.url);
}

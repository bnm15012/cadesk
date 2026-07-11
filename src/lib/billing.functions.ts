import { createServerFn } from "@tanstack/react-start";
import { createHmac } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type BillingPeriod = "monthly" | "yearly";

async function getTenantForAdmin(context: {
  supabase: import("@supabase/supabase-js").SupabaseClient<
    import("@/integrations/supabase/types").Database
  >;
  userId: string;
}) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "ca_admin",
  });
  if (!isAdmin) throw new Error("Only the firm admin can manage billing");

  const { data: profile } = await context.supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", context.userId)
    .single();
  if (!profile?.tenant_id) throw new Error("No firm found for this account");
  return profile.tenant_id;
}

export const createRazorpayOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string; billingPeriod: BillingPeriod }) => d)
  .handler(async ({ data, context }) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return { configured: false as const };
    }

    const tenantId = await getTenantForAdmin(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("id, name, price_monthly, price_yearly")
      .eq("id", data.planId)
      .eq("is_active", true)
      .single();
    if (!plan) throw new Error("Plan not found");

    const amount = data.billingPeriod === "yearly" ? plan.price_yearly : plan.price_monthly;

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt: `t${tenantId.slice(0, 12)}-${Date.now()}`,
        notes: { tenant_id: tenantId, plan_id: plan.id, billing_period: data.billingPeriod },
      }),
    });
    if (!res.ok) {
      console.error("Razorpay order creation failed:", res.status, await res.text());
      throw new Error("Could not start the payment. Please try again.");
    }
    const order = (await res.json()) as { id: string; amount: number; currency: string };

    await supabaseAdmin.from("payments").insert({
      tenant_id: tenantId,
      amount,
      currency: "INR",
      razorpay_order_id: order.id,
      status: "created",
    });

    return {
      configured: true as const,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      planName: plan.name,
    };
  });

export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      orderId: string;
      paymentId: string;
      signature: string;
      planId: string;
      billingPeriod: BillingPeriod;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) throw new Error("Payments are not configured yet");

    const tenantId = await getTenantForAdmin(context);

    const expected = createHmac("sha256", keySecret)
      .update(`${data.orderId}|${data.paymentId}`)
      .digest("hex");
    if (expected !== data.signature) {
      console.error("Razorpay signature mismatch for order", data.orderId);
      throw new Error("Payment verification failed");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("id, amount")
      .eq("razorpay_order_id", data.orderId)
      .eq("tenant_id", tenantId)
      .single();
    if (!payment) throw new Error("Payment record not found");

    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("id, name")
      .eq("id", data.planId)
      .single();
    if (!plan) throw new Error("Plan not found");

    const periodDays = data.billingPeriod === "yearly" ? 365 : 30;
    const periodStart = new Date().toISOString();
    const periodEnd = new Date(Date.now() + periodDays * 86400000).toISOString();

    const { data: existingSub } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let subscriptionId: string;
    if (existingSub) {
      subscriptionId = existingSub.id;
      await supabaseAdmin
        .from("subscriptions")
        .update({
          plan_id: plan.id,
          status: "active",
          billing_period: data.billingPeriod,
          current_period_start: periodStart,
          current_period_end: periodEnd,
        })
        .eq("id", existingSub.id);
    } else {
      const { data: inserted, error } = await supabaseAdmin
        .from("subscriptions")
        .insert({
          tenant_id: tenantId,
          plan_id: plan.id,
          status: "active",
          billing_period: data.billingPeriod,
          current_period_start: periodStart,
          current_period_end: periodEnd,
        })
        .select("id")
        .single();
      if (error || !inserted) throw new Error("Could not activate subscription");
      subscriptionId = inserted.id;
    }

    await supabaseAdmin
      .from("payments")
      .update({
        status: "paid",
        razorpay_payment_id: data.paymentId,
        subscription_id: subscriptionId,
      })
      .eq("id", payment.id);

    return { success: true as const, planName: plan.name };
  });
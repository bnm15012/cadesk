import { createServerFn } from "@tanstack/react-start";
import { createHmac } from "crypto";
import { eq, and, desc } from "drizzle-orm";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getDb } from "@/lib/db";
import { payments, plans, profiles, subscriptions } from "@/lib/db/schema";
import { hasRole } from "@/lib/db/helpers";

type BillingPeriod = "monthly" | "yearly";

async function getTenantForAdmin(context: {
  supabase: import("@supabase/supabase-js").SupabaseClient<
    import("@/integrations/supabase/types").Database
  >;
  userId: string;
}) {
  const isAdmin = await hasRole(context.userId, "ca_admin");
  if (!isAdmin) throw new Error("Only the firm admin can manage billing");

  const rows = await getDb()
    .select({ tenant_id: profiles.tenant_id })
    .from(profiles)
    .where(eq(profiles.id, context.userId))
    .limit(1);
  if (!rows[0]?.tenant_id) throw new Error("No firm found for this account");
  return rows[0].tenant_id;
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

    const planRows = await getDb()
      .select({
        id: plans.id,
        name: plans.name,
        price_monthly: plans.price_monthly,
        price_yearly: plans.price_yearly,
      })
      .from(plans)
      .where(and(eq(plans.id, Number(data.planId)), eq(plans.is_active, true)))
      .limit(1);
    const plan = planRows[0];
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
        receipt: `t${tenantId}-${Date.now()}`,
        notes: { tenant_id: tenantId, plan_id: plan.id, billing_period: data.billingPeriod },
      }),
    });
    if (!res.ok) {
      console.error("Razorpay order creation failed:", res.status, await res.text());
      throw new Error("Could not start the payment. Please try again.");
    }
    const order = (await res.json()) as { id: string; amount: number; currency: string };

    await getDb().insert(payments).values({
      tenant_id: tenantId,
      amount,
      currency: "INR",
      razorpay_order_id: order.id,
      status: "created",
      created_at: new Date(),
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

    const paymentRows = await getDb()
      .select({ id: payments.id, amount: payments.amount })
      .from(payments)
      .where(and(eq(payments.razorpay_order_id, data.orderId), eq(payments.tenant_id, tenantId)))
      .limit(1);
    const payment = paymentRows[0];
    if (!payment) throw new Error("Payment record not found");

    const planRows = await getDb()
      .select({ id: plans.id, name: plans.name })
      .from(plans)
      .where(eq(plans.id, Number(data.planId)))
      .limit(1);
    const plan = planRows[0];
    if (!plan) throw new Error("Plan not found");

    const periodDays = data.billingPeriod === "yearly" ? 365 : 30;
    const periodStart = new Date();
    const periodEnd = new Date(Date.now() + periodDays * 86400000);

    const existingSubRows = await getDb()
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.tenant_id, tenantId))
      .orderBy(desc(subscriptions.created_at))
      .limit(1);
    const existingSub = existingSubRows[0];

    let subscriptionId: number;
    if (existingSub) {
      subscriptionId = existingSub.id;
      await getDb()
        .update(subscriptions)
        .set({
          plan_id: plan.id,
          status: "active",
          billing_period: data.billingPeriod,
          current_period_start: periodStart,
          current_period_end: periodEnd,
        })
        .where(eq(subscriptions.id, existingSub.id));
    } else {
      const [{ id: insertedSubId }] = await getDb().insert(subscriptions).values({
        tenant_id: tenantId,
        plan_id: plan.id,
        status: "active",
        billing_period: data.billingPeriod,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        created_at: new Date(),
        updated_at: new Date(),
      }).$returningId();
      subscriptionId = insertedSubId;
    }

    await getDb()
      .update(payments)
      .set({
        status: "paid",
        razorpay_payment_id: data.paymentId,
        subscription_id: subscriptionId,
      })
      .where(eq(payments.id, payment.id));

    return { success: true as const, planName: plan.name };
  });

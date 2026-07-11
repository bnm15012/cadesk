import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentUser } from "@/hooks/use-current-user";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CreditCard, Loader2, Zap, Star, Building2 } from "lucide-react";
import { toast } from "sonner";
import { createRazorpayOrder, verifyRazorpayPayment, getPublicPlans, getCurrentSubscription } from "@/lib/billing.functions";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({ meta: [{ title: "Billing — CADesk" }] }),
  component: BillingPage,
});

type PlanRow = Awaited<ReturnType<typeof getPublicPlans>>[number];

function fmtINR(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

const PLAN_ICONS = [Zap, Star, Building2];
const PLAN_HIGHLIGHT = [false, true, false]; // Professional is highlighted

function BillingPage() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const createOrder = useServerFn(createRazorpayOrder);
  const verifyPayment = useServerFn(verifyRazorpayPayment);
  const fetchPlans = useServerFn(getPublicPlans);
  const fetchSub = useServerFn(getCurrentSubscription);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [payingPlanId, setPayingPlanId] = useState<number | null>(null);

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: () => fetchPlans(),
  });

  const { data: sub } = useQuery({
    queryKey: ["subscription", user?.tenantId],
    enabled: !!user,
    queryFn: () => fetchSub(),
  });

  const trialDaysLeft = sub?.current_period_end
    ? Math.max(0, Math.ceil((new Date(sub.current_period_end).getTime() - Date.now()) / 86400000))
    : null;

  async function choosePlan(p: PlanRow) {
    setPayingPlanId(p.id);
    try {
      const result = await createOrder({ data: { planId: String(p.id), billingPeriod } });
      if (!result.configured) {
        toast.info("Payments aren't live yet — Razorpay credentials still need to be configured.");
        return;
      }
      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        toast.error("Could not load Razorpay checkout. Check your connection and try again.");
        return;
      }
      const rzp = new window.Razorpay({
        key: result.keyId,
        amount: result.amount,
        currency: result.currency,
        name: "CADesk",
        description: `${result.planName} plan (${billingPeriod})`,
        order_id: result.orderId,
        prefill: { email: user?.email ?? "" },
        handler: async (response: { razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const verified = await verifyPayment({
              data: {
                orderId: result.orderId,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                planId: String(p.id),
                billingPeriod,
              },
            });
            toast.success(`Payment successful — ${verified.planName} plan is now active!`);
            queryClient.invalidateQueries({ queryKey: ["subscription"] });
          } catch {
            toast.error("Payment verification failed. Please contact support.");
          }
        },
      });
      rzp.open();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setPayingPlanId(null);
    }
  }

  return (
    <AppShell>
      {/* Page header banner */}
      <div className="rounded-lg px-6 py-5 mb-6 bg-white border-l-4 border-l-slate-700 border border-border shadow-sm">
        <h1 className="font-display text-2xl font-semibold">Billing</h1>
        <p className="mt-1 text-muted-foreground text-sm">Manage your subscription</p>
      </div>

      {/* Current subscription status */}
      {sub && (
        <Card className="mb-8 bg-white">
          <CardContent className="pt-5 pb-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                  <CreditCard className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Current plan</p>
                  <p className="font-semibold">{sub.plan_name ?? "Free trial"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {sub.status === "trial" && trialDaysLeft !== null && (
                  <span className="text-sm text-muted-foreground">{trialDaysLeft} days left in trial</span>
                )}
                <Badge
                  variant="outline"
                  className={
                    sub.status === "active"   ? "bg-green-50 text-green-700 border-green-200" :
                    sub.status === "trial"    ? "bg-blue-50 text-blue-700 border-blue-200" :
                    "bg-red-50 text-red-700 border-red-200"
                  }
                >
                  {sub.status === "trial" ? "Free Trial" : sub.status === "active" ? "Active" : sub.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billing period toggle */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Choose a plan</h2>
          <p className="text-sm text-muted-foreground">Upgrade anytime, cancel anytime</p>
        </div>
        <div className="inline-flex items-center rounded-lg border border-border bg-white p-1 gap-1">
          <Button
            variant={billingPeriod === "monthly" ? "default" : "ghost"}
            size="sm"
            onClick={() => setBillingPeriod("monthly")}
            className="rounded-md"
          >
            Monthly
          </Button>
          <Button
            variant={billingPeriod === "yearly" ? "default" : "ghost"}
            size="sm"
            onClick={() => setBillingPeriod("yearly")}
            className="rounded-md"
          >
            Yearly
            <span className="ml-1.5 rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">−17%</span>
          </Button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid gap-5 md:grid-cols-3">
        {(plans ?? []).map((p, i) => {
          const Icon = PLAN_ICONS[i] ?? Zap;
          const highlighted = PLAN_HIGHLIGHT[i] ?? false;
          return (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md ${
                highlighted ? "border-slate-700 ring-1 ring-slate-700" : "border-border"
              }`}
            >
              {highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-white">Most popular</span>
                </div>
              )}

              {/* Icon + name */}
              <div className="mb-4 flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${highlighted ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-lg font-semibold">{p.name}</p>
                  {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                </div>
              </div>

              {/* Price */}
              <div className="mb-1">
                <span className="font-display text-3xl font-bold">
                  {billingPeriod === "monthly" ? fmtINR(p.price_monthly) : fmtINR(p.price_yearly)}
                </span>
                <span className="ml-1 text-sm text-muted-foreground">
                  {billingPeriod === "monthly" ? "/month" : "/year"}
                </span>
              </div>
              {billingPeriod === "yearly" && (
                <p className="mb-4 text-xs text-green-600 font-medium">
                  Equivalent to {fmtINR(Math.round(p.price_yearly / 12))}/mo
                </p>
              )}
              {billingPeriod === "monthly" && (
                <p className="mb-4 text-xs text-muted-foreground">
                  {fmtINR(p.price_yearly)}/yr if billed annually
                </p>
              )}

              <hr className="mb-4 border-border" />

              {/* Features */}
              <ul className="mb-6 flex-1 space-y-2.5 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                  <span>Up to <strong>{p.max_clients}</strong> clients</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                  <span><strong>{p.max_staff}</strong> team members</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                  <span><strong>{p.storage_gb} GB</strong> storage</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                  <span><strong>{p.max_templates}</strong> templates</span>
                </li>
                {Object.entries(p.features ?? {}).map(([k, v]) =>
                  v ? (
                    <li key={k} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                      <span className="capitalize">{k.replaceAll("_", " ")}</span>
                    </li>
                  ) : null
                )}
              </ul>

              <Button
                className={`w-full ${highlighted ? "" : "variant-outline"}`}
                variant={highlighted ? "default" : "outline"}
                disabled={payingPlanId !== null}
                onClick={() => choosePlan(p)}
              >
                {payingPlanId === p.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Get started with {p.name}
              </Button>
            </div>
          );
        })}
      </div>

      <p className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <CreditCard className="h-3.5 w-3.5" />
        Payments processed securely via Razorpay.
      </p>
    </AppShell>
  );
}

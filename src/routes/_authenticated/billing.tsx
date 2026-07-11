import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createRazorpayOrder, verifyRazorpayPayment } from "@/lib/billing.functions";

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
  head: () => ({ meta: [{ title: "Billing — PracticeVault" }] }),
  component: BillingPage,
});

interface PlanRow {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  max_clients: number;
  max_staff: number;
  storage_gb: number;
  max_templates: number;
  features: Record<string, boolean>;
}

function fmtINR(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function BillingPage() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const createOrder = useServerFn(createRazorpayOrder);
  const verifyPayment = useServerFn(verifyRazorpayPayment);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [payingPlanId, setPayingPlanId] = useState<string | null>(null);

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("*").eq("is_active", true).order("sort_order");
      return (data ?? []) as unknown as PlanRow[];
    },
  });

  const { data: sub } = useQuery({
    queryKey: ["subscription", user?.tenantId],
    enabled: !!user?.tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("*, plans(name)")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const trialDaysLeft = sub?.current_period_end
    ? Math.max(0, Math.ceil((new Date(sub.current_period_end).getTime() - Date.now()) / 86400000))
    : null;

  async function choosePlan(p: PlanRow) {
    setPayingPlanId(p.id);
    try {
      const result = await createOrder({ data: { planId: p.id, billingPeriod } });
      if (!result.configured) {
        toast.info(
          "Payments aren't live yet — the Razorpay Key ID & Secret still need to be added in Cloud secrets.",
        );
        return;
      }
      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        toast.error("Could not load the Razorpay checkout. Check your connection and try again.");
        return;
      }
      const rzp = new window.Razorpay({
        key: result.keyId,
        amount: result.amount,
        currency: result.currency,
        name: "PracticeVault",
        description: `${result.planName} plan (${billingPeriod})`,
        order_id: result.orderId,
        prefill: { email: user?.email ?? "" },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verified = await verifyPayment({
              data: {
                orderId: result.orderId,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                planId: p.id,
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
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold">Billing</h1>
        <p className="mt-1 text-muted-foreground">Manage your subscription and plan.</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <CreditCard className="h-5 w-5" /> Current subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sub ? (
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={sub.status === "trial" ? "secondary" : sub.status === "active" ? "default" : "destructive"}>
                {sub.status}
              </Badge>
              <span className="text-sm">
                Plan: <strong>{(sub.plans as { name: string } | null)?.name ?? "Free trial"}</strong>
              </span>
              {sub.status === "trial" && trialDaysLeft !== null && (
                <span className="text-sm text-muted-foreground">· {trialDaysLeft} days left in trial</span>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No subscription found.</p>
          )}
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">Choose a plan</h2>
        <div className="inline-flex rounded-md border border-border p-0.5">
          <Button
            variant={billingPeriod === "monthly" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setBillingPeriod("monthly")}
          >
            Monthly
          </Button>
          <Button
            variant={billingPeriod === "yearly" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setBillingPeriod("yearly")}
          >
            Yearly
          </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {(plans ?? []).map((p) => (
          <Card key={p.id} className="flex flex-col">
            <CardContent className="flex flex-1 flex-col pt-6">
              <p className="font-display text-xl font-semibold">{p.name}</p>
              {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
              <p className="mt-4 font-display text-3xl font-semibold">
                {billingPeriod === "monthly" ? fmtINR(p.price_monthly) : fmtINR(p.price_yearly)}
                <span className="text-sm font-normal text-muted-foreground">
                  {billingPeriod === "monthly" ? "/mo" : "/yr"}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {billingPeriod === "monthly"
                  ? `or ${fmtINR(p.price_yearly)}/yr (save ~17%)`
                  : `equivalent to ${fmtINR(Math.round(p.price_yearly / 12))}/mo`}
              </p>

              <ul className="mt-4 flex-1 space-y-2 text-sm">
                <FeatureLine label={`${p.max_clients} clients`} />
                <FeatureLine label={`${p.max_staff} team members`} />
                <FeatureLine label={`${p.storage_gb} GB storage`} />
                <FeatureLine label={`${p.max_templates} templates`} />
                {Object.entries(p.features ?? {}).map(([k, v]) => v && <FeatureLine key={k} label={k.replaceAll("_", " ")} />)}
              </ul>

              <Button
                className="mt-6"
                disabled={payingPlanId !== null}
                onClick={() => choosePlan(p)}
              >
                {payingPlanId === p.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Choose {p.name}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Payments are processed securely via Razorpay. Checkout goes live automatically once the
        Razorpay Key ID & Secret are added.
      </p>
    </AppShell>
  );
}

function FeatureLine({ label }: { label: string }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      <span className="capitalize">{label}</span>
    </li>
  );
}

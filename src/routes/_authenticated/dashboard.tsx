import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, FolderOpen, CheckCircle2, Clock, UserCog, CreditCard } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — PracticeVault" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.isClient && !user.isFirmMember) {
      navigate({ to: "/portal", replace: true });
    }
  }, [user, navigate]);

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", user?.tenantId],
    enabled: !!user?.tenantId && user.isFirmMember,
    queryFn: async () => {
      const [clients, items, staff, subscription, activity] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("request_items").select("status"),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).in("role", ["manager", "staff"]),
        supabase.from("subscriptions").select("*, plans(name)").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase
          .from("activity_logs")
          .select("id, action, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      const statuses = (items.data ?? []).map((i) => i.status);
      return {
        clientCount: clients.count ?? 0,
        pendingUploads: statuses.filter((s) => s === "pending" || s === "reupload_required").length,
        pendingReviews: statuses.filter((s) => s === "uploaded" || s === "under_review").length,
        approved: statuses.filter((s) => s === "approved").length,
        staffCount: staff.count ?? 0,
        subscription: subscription.data,
        activity: activity.data ?? [],
      };
    },
  });

  const sub = stats?.subscription;
  const trialDaysLeft = sub?.current_period_end
    ? Math.max(0, Math.ceil((new Date(sub.current_period_end).getTime() - Date.now()) / 86400000))
    : null;

  const cards = [
    { label: "Total Clients", value: stats?.clientCount ?? "—", icon: Users, to: "/clients" },
    { label: "Pending Uploads", value: stats?.pendingUploads ?? "—", icon: Clock, to: "/requests" },
    { label: "Pending Reviews", value: stats?.pendingReviews ?? "—", icon: FolderOpen, to: "/requests" },
    { label: "Approved Documents", value: stats?.approved ?? "—", icon: CheckCircle2, to: "/requests" },
    { label: "Team Members", value: stats?.staffCount ?? "—", icon: UserCog, to: "/team" },
  ];

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">{user?.tenantName}</p>
        </div>
        {sub && (
          <Link to="/billing" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <Badge variant={sub.status === "trial" ? "secondary" : "default"}>
              {sub.status === "trial"
                ? `Free trial — ${trialDaysLeft} days left`
                : `${(sub.plans as { name: string } | null)?.name ?? "Plan"} · ${sub.status}`}
            </Badge>
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <Link key={c.label} to={c.to}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="pt-6">
                <c.icon className="mb-3 h-5 w-5 text-muted-foreground" />
                <p className="font-display text-3xl font-semibold">{c.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="font-display text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.activity.length ? (
            <ul className="divide-y divide-border">
              {stats.activity.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span>{a.action}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {format(new Date(a.created_at), "d MMM, h:mm a")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">
              No activity yet. Start by adding your first client.
            </p>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}

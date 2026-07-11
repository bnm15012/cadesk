import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getDashboardStats } from "@/lib/dashboard.functions";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, FolderOpen, CheckCircle2, Clock, UserCog, CreditCard, Upload, FileSearch } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — CADesk" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const fetchStats = useServerFn(getDashboardStats);

  useEffect(() => {
    if (user && user.isClient && !user.isFirmMember) {
      navigate({ to: "/portal", replace: true });
    }
  }, [user, navigate]);

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", user?.tenantId],
    enabled: !!user?.tenantId && user.isFirmMember,
    queryFn: () => fetchStats(),
  });

  const sub = stats?.subscription;
  const trialDaysLeft = sub?.current_period_end
    ? Math.max(0, Math.ceil((new Date(sub.current_period_end).getTime() - Date.now()) / 86400000))
    : null;

  const cards = [
    { label: "Total Clients", value: stats?.clientCount ?? "—", icon: Users, to: "/clients", iconClass: "text-blue-500", borderClass: "border-l-4 border-l-blue-400" },
    { label: "Pending Uploads", value: stats?.pendingUploads ?? "—", icon: Clock, to: "/requests", iconClass: "text-amber-500", borderClass: "border-l-4 border-l-amber-400" },
    { label: "Pending Reviews", value: stats?.pendingReviews ?? "—", icon: FolderOpen, to: "/requests", iconClass: "text-purple-500", borderClass: "border-l-4 border-l-purple-400" },
    { label: "Approved Documents", value: stats?.approved ?? "—", icon: CheckCircle2, to: "/requests", iconClass: "text-green-500", borderClass: "border-l-4 border-l-green-400" },
    { label: "Team Members", value: stats?.staffCount ?? "—", icon: UserCog, to: "/team", iconClass: "text-indigo-500", borderClass: "border-l-4 border-l-indigo-400" },
  ];

  return (
    <AppShell>
      {/* Page header banner */}
      <div className="rounded-lg px-6 py-5 mb-6 bg-white border-l-4 border-l-slate-700 border border-border shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-muted-foreground text-sm">Welcome back — here's your firm overview</p>
        </div>
        {sub && (
          <Link to="/billing" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <Badge variant={sub.status === "trial" ? "secondary" : "default"}>
              {sub.status === "trial"
                ? `Free trial — ${trialDaysLeft} days left`
                : `${sub.planName ?? "Plan"} · ${sub.status}`}
            </Badge>
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <Link key={c.label} to={c.to}>
            <Card className={`transition-shadow hover:shadow-md overflow-hidden ${c.borderClass}`}>
              <CardContent className="pt-6">
                <c.icon className={`mb-3 h-5 w-5 ${c.iconClass}`} />
                <p className="font-display text-3xl font-semibold">{c.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Pending breakdown + Recent Activity */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">

        {/* Pending Uploads by Client */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-amber-500" /> Pending Uploads
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {stats?.pendingUploadsByClient?.length ? (
              <ul className="divide-y divide-border">
                {stats.pendingUploadsByClient.map((c) => (
                  <li key={c.clientId}>
                    <Link
                      to="/clients/$clientId"
                      params={{ clientId: String(c.clientId) }}
                      className="flex items-center justify-between py-2.5 text-sm hover:text-primary"
                    >
                      <span className="truncate">{c.clientName}</span>
                      <Badge variant="outline" className="ml-2 shrink-0 bg-amber-50 text-amber-700 border-amber-200">
                        {c.count} doc{c.count !== 1 ? "s" : ""}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-sm text-muted-foreground">No pending uploads.</p>
            )}
          </CardContent>
        </Card>

        {/* Pending Reviews by Client */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-purple-500" /> Pending Reviews
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {stats?.pendingReviewsByClient?.length ? (
              <ul className="divide-y divide-border">
                {stats.pendingReviewsByClient.map((c) => (
                  <li key={c.clientId}>
                    <Link
                      to="/clients/$clientId"
                      params={{ clientId: String(c.clientId) }}
                      className="flex items-center justify-between py-2.5 text-sm hover:text-primary"
                    >
                      <span className="truncate">{c.clientName}</span>
                      <Badge variant="outline" className="ml-2 shrink-0 bg-purple-50 text-purple-700 border-purple-200">
                        {c.count} doc{c.count !== 1 ? "s" : ""}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-sm text-muted-foreground">No pending reviews.</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {stats?.activity.length ? (
              <ul className="divide-y divide-border">
                {stats.activity.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                    <span className="leading-snug">{a.action}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {format(new Date(a.created_at), "d MMM, h:mm a")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-sm text-muted-foreground">No activity yet.</p>
            )}
          </CardContent>
        </Card>

      </div>
    </AppShell>
  );
}

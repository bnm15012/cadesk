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
        {(() => {
          const rows = stats?.pendingUploadsByClient ?? [];
          const visible = rows.slice(0, 5);
          const extra = rows.length - visible.length;
          return (
            <div className="rounded-lg border border-border bg-white overflow-hidden flex flex-col">
              <div className="flex items-center gap-2 border-b border-border bg-amber-50 px-4 py-3">
                <Upload className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">Pending Uploads</span>
                {rows.length > 0 && (
                  <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                    {rows.length}
                  </span>
                )}
              </div>
              {rows.length ? (
                <>
                  <ul className="flex-1">
                    {visible.map((c, i) => (
                      <li key={c.clientId} className={i !== 0 ? "border-t border-border" : ""}>
                        <Link
                          to="/clients/$clientId"
                          params={{ clientId: String(c.clientId) }}
                          className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-700">
                              {c.clientName[0].toUpperCase()}
                            </span>
                            <span className="text-sm font-medium truncate">{c.clientName}</span>
                          </div>
                          <Badge variant="outline" className="ml-3 shrink-0 bg-amber-50 text-amber-700 border-amber-200 text-xs">
                            {c.count} doc{c.count !== 1 ? "s" : ""}
                          </Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-border px-4 py-2.5 flex items-center justify-between">
                    {extra > 0 ? (
                      <span className="text-xs text-muted-foreground">+{extra} more client{extra !== 1 ? "s" : ""}</span>
                    ) : <span />}
                    <Link to="/requests" className="text-xs text-primary font-medium hover:underline">
                      View all requests →
                    </Link>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
                  <CheckCircle2 className="h-6 w-6 text-green-400 mb-2" />
                  <p className="text-sm text-muted-foreground">All caught up!</p>
                </div>
              )}
            </div>
          );
        })()}

        {/* Pending Reviews by Client */}
        {(() => {
          const rows = stats?.pendingReviewsByClient ?? [];
          const visible = rows.slice(0, 5);
          const extra = rows.length - visible.length;
          return (
            <div className="rounded-lg border border-border bg-white overflow-hidden flex flex-col">
              <div className="flex items-center gap-2 border-b border-border bg-purple-50 px-4 py-3">
                <FileSearch className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-semibold text-purple-800">Pending Reviews</span>
                {rows.length > 0 && (
                  <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 text-xs font-bold text-white">
                    {rows.length}
                  </span>
                )}
              </div>
              {rows.length ? (
                <>
                  <ul className="flex-1">
                    {visible.map((c, i) => (
                      <li key={c.clientId} className={i !== 0 ? "border-t border-border" : ""}>
                        <Link
                          to="/clients/$clientId"
                          params={{ clientId: String(c.clientId) }}
                          className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-semibold text-purple-700">
                              {c.clientName[0].toUpperCase()}
                            </span>
                            <span className="text-sm font-medium truncate">{c.clientName}</span>
                          </div>
                          <Badge variant="outline" className="ml-3 shrink-0 bg-purple-50 text-purple-700 border-purple-200 text-xs">
                            {c.count} doc{c.count !== 1 ? "s" : ""}
                          </Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-border px-4 py-2.5 flex items-center justify-between">
                    {extra > 0 ? (
                      <span className="text-xs text-muted-foreground">+{extra} more client{extra !== 1 ? "s" : ""}</span>
                    ) : <span />}
                    <Link to="/requests" className="text-xs text-primary font-medium hover:underline">
                      View all requests →
                    </Link>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
                  <CheckCircle2 className="h-6 w-6 text-green-400 mb-2" />
                  <p className="text-sm text-muted-foreground">Nothing to review!</p>
                </div>
              )}
            </div>
          );
        })()}

        {/* Recent Activity */}
        {(() => {
          const rows = stats?.activity ?? [];
          const visible = rows.slice(0, 10);
          return (
            <div className="rounded-lg border border-border bg-white overflow-hidden flex flex-col">
              <div className="flex items-center gap-2 border-b border-border bg-slate-50 px-4 py-3">
                <span className="text-sm font-semibold text-slate-700">Recent Activity</span>
              </div>
              {rows.length ? (
                <>
                  <ul className="flex-1">
                    {visible.map((a, i) => (
                      <li key={a.id} className={`flex items-center justify-between gap-3 px-4 py-2.5 ${i !== 0 ? "border-t border-border" : ""}`}>
                        <span className="text-sm truncate">{a.action}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{format(new Date(a.created_at), "d MMM, h:mm a")}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-border px-4 py-2.5 flex justify-end">
                    <Link to="/activity" className="text-xs text-primary font-medium hover:underline">
                      View all activity →
                    </Link>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
                </div>
              )}
            </div>
          );
        })()}

      </div>
    </AppShell>
  );
}

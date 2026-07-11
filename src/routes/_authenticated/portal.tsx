import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getPortalRequests } from "@/lib/portal.functions";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, ChevronRight, CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({ meta: [{ title: "My Documents — CADesk" }] }),
  component: PortalPage,
});

function PortalPage() {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const fetchRequests = useServerFn(getPortalRequests);

  useEffect(() => {
    if (user && !user.isClient) navigate({ to: "/dashboard", replace: true });
  }, [user, navigate]);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["portal-requests", user?.clientId],
    enabled: !!user?.clientId,
    queryFn: () => fetchRequests(),
  });

  return (
    <AppShell>
      {/* Page header banner */}
      <div className="rounded-lg px-6 py-5 mb-6 bg-white border-l-4 border-l-slate-700 border border-border shadow-sm">
        <h1 className="font-display text-2xl font-semibold">My Documents</h1>
        <p className="mt-1 text-muted-foreground text-sm">Your document requests</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (requests ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <FolderOpen className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No document requests yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Your CA will create requests here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {(requests ?? []).map((r) => {
            const items = r.request_items;
            const pending = items.filter((i) => i.status === "pending" || i.status === "reupload_required").length;
            const submitted = items.filter((i) => i.status !== "pending" && i.status !== "reupload_required").length;
            const total = items.length;
            const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
            const allDone = pending === 0;
            return (
              <Link key={r.id} to="/requests/$requestId" params={{ requestId: String(r.id) }}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="pt-5 pb-4">
                    {/* Top row: title + FY badge + status */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-base">{r.title}</p>
                        <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-mono text-xs">
                          {r.fyLabel}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {allDone ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> All submitted
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {pending} pending
                          </Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{submitted} of {total} documents submitted</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100">
                        <div
                          className={`h-1.5 rounded-full transition-all ${allDone ? "bg-green-500" : "bg-amber-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

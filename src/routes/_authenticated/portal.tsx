import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getPortalRequests } from "@/lib/portal.functions";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FolderOpen, CheckCircle2, Clock, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({ meta: [{ title: "My Documents — CA Vault" }] }),
  component: PortalPage,
});

function PortalPage() {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const fetchRequests = useServerFn(getPortalRequests);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (user && !user.isClient) navigate({ to: "/dashboard", replace: true });
  }, [user, navigate]);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["portal-requests", user?.clientId],
    enabled: !!user?.clientId,
    queryFn: () => fetchRequests(),
  });

  const filtered = (requests ?? []).filter((r) => {
    const q = search.toLowerCase();
    return !q || r.title.toLowerCase().includes(q) || (r.fyLabel ?? "").toLowerCase().includes(q);
  });

  return (
    <AppShell>
      {/* Page header banner */}
      <div className="rounded-lg px-6 py-5 mb-6 bg-white border-l-4 border-l-slate-700 border border-border shadow-sm">
        <h1 className="font-display text-2xl font-semibold">My Documents</h1>
        <p className="mt-1 text-muted-foreground text-sm">Your document requests from your CA</p>
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
        <>
          {/* Search */}
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title or financial year…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {filtered.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-center">
                <Search className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="font-medium">No matching requests</p>
                <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border border-border bg-white overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead className="hidden sm:table-cell">Financial Year</TableHead>
                    <TableHead className="hidden sm:table-cell">Progress</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const items = r.request_items;
                    const pending = items.filter((i) => i.status === "pending" || i.status === "reupload_required").length;
                    const submitted = items.filter((i) => i.status !== "pending" && i.status !== "reupload_required").length;
                    const total = items.length;
                    const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
                    const allDone = pending === 0;
                    return (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate({ to: "/requests/$requestId", params: { requestId: String(r.id) } })}
                      >
                        <TableCell className="font-medium">
                          {r.title}
                          <p className="text-xs text-muted-foreground sm:hidden">{r.fyLabel} · {submitted}/{total} submitted</p>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{r.fyLabel}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 rounded-full bg-slate-100">
                              <div
                                className={`h-1.5 rounded-full ${allDone ? "bg-green-500" : "bg-amber-400"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{submitted}/{total}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {allDone ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200 flex items-center gap-1 w-fit">
                              <CheckCircle2 className="h-3 w-3" /> Done
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1 w-fit">
                              <Clock className="h-3 w-3" /> {pending} pending
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

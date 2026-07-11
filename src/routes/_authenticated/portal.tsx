import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({ meta: [{ title: "My Documents — CADesk" }] }),
  component: PortalPage,
});

function PortalPage() {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !user.isClient) navigate({ to: "/dashboard", replace: true });
  }, [user, navigate]);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["portal-requests", user?.clientId],
    enabled: !!user?.clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_requests")
        .select("*, financial_years(label), request_items(status)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold">My Documents</h1>
        <p className="mt-1 text-muted-foreground">Upload documents requested by your CA.</p>
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
            const items = r.request_items as unknown as { status: string }[];
            const pending = items.filter((i) => i.status === "pending" || i.status === "reupload_required").length;
            const total = items.length;
            return (
              <Link key={r.id} to="/requests/$requestId" params={{ requestId: r.id }}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between pt-6">
                    <div>
                      <p className="font-medium">{r.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {(r.financial_years as { label: string } | null)?.label} · {total - pending}/{total} submitted
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {pending > 0 ? (
                        <Badge variant="secondary">{pending} pending</Badge>
                      ) : (
                        <Badge>All submitted</Badge>
                      )}
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
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

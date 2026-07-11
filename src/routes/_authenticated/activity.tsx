import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getActivityLogs } from "@/lib/activity.functions";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { History } from "lucide-react";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "Activity Log — CADesk" }] }),
  component: ActivityPage,
});

function ActivityPage() {
  const fetchLogs = useServerFn(getActivityLogs);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["activity"],
    queryFn: () => fetchLogs(),
  });

  return (
    <AppShell>
      {/* Page header banner */}
      <div className="rounded-lg px-6 py-5 mb-6 bg-white border-l-4 border-l-slate-700 border border-border shadow-sm">
        <h1 className="font-display text-2xl font-semibold">Activity Log</h1>
        <p className="mt-1 text-muted-foreground text-sm">Recent actions across your firm</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (logs ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <History className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No activity yet</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {(logs ?? []).map((log) => (
                <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 text-sm">
                  <div className="flex flex-col">
                    <span>{log.action}</span>
                    <span className="text-xs text-muted-foreground">
                      {log.userName}
                      {log.entity_type ? ` · ${log.entity_type}` : ""}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {format(new Date(log.created_at), "d MMM yyyy, h:mm a")}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}

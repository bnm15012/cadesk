import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { History } from "lucide-react";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "Activity Log — PracticeVault" }] }),
  component: ActivityPage,
});

function ActivityPage() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const userIds = [...new Set((data ?? []).map((l) => l.user_id).filter(Boolean) as string[])];
      const profileMap = new Map<string, string>();
      if (userIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        (profs ?? []).forEach((p) => profileMap.set(p.id, p.full_name));
      }
      return (data ?? []).map((l) => ({ ...l, userName: l.user_id ? profileMap.get(l.user_id) ?? "User" : "System" }));
    },
  });

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold">Activity Log</h1>
        <p className="mt-1 text-muted-foreground">Recent actions across your firm.</p>
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

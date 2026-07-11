import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, hasPerm } from "@/hooks/use-current-user";
import { logActivity } from "@/lib/activity";
import { createClientLogin } from "@/lib/team.functions";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, KeyRound, UserPlus } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/clients_/$clientId")({
  head: () => ({ meta: [{ title: "Client — CADesk" }] }),
  component: ClientDetailPage,
});

function ClientDetailPage() {
  const { clientId } = Route.useParams();
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const createLogin = useServerFn(createClientLogin);
  const [loginOpen, setLoginOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const [client, assignments, members, requests] = await Promise.all([
        supabase.from("clients").select("*").eq("id", clientId).maybeSingle(),
        supabase.from("client_assignments").select("user_id").eq("client_id", clientId),
        supabase
          .from("user_roles")
          .select("user_id, role, profiles:user_id(full_name)")
          .in("role", ["manager", "staff"]),
        supabase
          .from("document_requests")
          .select("*, financial_years(label)")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),
      ]);
      // profiles join via user_roles doesn't exist as FK; fetch profiles separately
      const memberIds = (members.data ?? []).map((m) => m.user_id);
      const { data: profiles } = memberIds.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", memberIds)
        : { data: [] };
      return {
        client: client.data,
        assignedIds: new Set((assignments.data ?? []).map((a) => a.user_id)),
        members: (members.data ?? []).map((m) => ({
          userId: m.user_id,
          role: m.role,
          name: profiles?.find((p) => p.id === m.user_id)?.full_name ?? "Unknown",
        })),
        requests: requests.data ?? [],
      };
    },
  });

  const client = data?.client;

  const toggleAssignment = async (memberId: string, assigned: boolean) => {
    if (!user?.tenantId || !client) return;
    if (assigned) {
      const { error } = await supabase
        .from("client_assignments")
        .delete()
        .eq("client_id", clientId)
        .eq("user_id", memberId);
      if (error) return void toast.error(error.message);
    } else {
      const { error } = await supabase.from("client_assignments").insert({
        tenant_id: user.tenantId,
        client_id: clientId,
        user_id: memberId,
      });
      if (error) return void toast.error(error.message);
    }
    logActivity({
      tenantId: user.tenantId,
      userId: user.userId,
      action: `${assigned ? "Unassigned" : "Assigned"} team member on client ${client.name}`,
      entityType: "client",
      entityId: clientId,
    });
    queryClient.invalidateQueries({ queryKey: ["client", clientId] });
  };

  const handleCreateLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await createLogin({
        data: {
          clientId,
          email: String(form.get("email")),
          password: String(form.get("password")),
        },
      });
      toast.success("Portal login created. Share the credentials with your client.");
      setLoginOpen(false);
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create login");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!client || !user?.tenantId) return;
    if (!confirm(`Delete client ${client.name}? This removes all their requests and documents.`)) return;
    const { error } = await supabase.from("clients").delete().eq("id", clientId);
    if (error) return void toast.error(error.message);
    logActivity({
      tenantId: user.tenantId,
      userId: user.userId,
      action: `Deleted client ${client.name}`,
      entityType: "client",
    });
    toast.success("Client deleted");
    navigate({ to: "/clients" });
  };

  if (isLoading) {
    return (
      <AppShell>
        <p className="text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }
  if (!client) {
    return (
      <AppShell>
        <p className="text-muted-foreground">Client not found or you don't have access.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link to="/clients" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All clients
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">{client.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
            {client.pan && <span>PAN: {client.pan}</span>}
            {client.gstin && <span>· GSTIN: {client.gstin}</span>}
            {client.mobile && <span>· {client.mobile}</span>}
            {client.email && <span>· {client.email}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {!client.portal_user_id && hasPerm(user, "clients.edit") && (
            <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <KeyRound className="mr-2 h-4 w-4" /> Create portal login
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create client portal login</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cl-email">Client email *</Label>
                    <Input id="cl-email" name="email" type="email" defaultValue={client.email ?? ""} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cl-pass">Temporary password *</Label>
                    <Input id="cl-pass" name="password" type="text" minLength={8} required />
                    <p className="text-xs text-muted-foreground">
                      Minimum 8 characters. Share these credentials with your client securely.
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? "Creating…" : "Create login"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
          {hasPerm(user, "clients.delete") && (
            <Button variant="outline" className="text-destructive" onClick={handleDelete}>
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="font-display text-lg">Document Requests</CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link to="/requests">New request</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data?.requests.length ? (
              <ul className="divide-y divide-border">
                {data.requests.map((r) => (
                  <li key={r.id} className="py-3">
                    <Link
                      to="/requests/$requestId"
                      params={{ requestId: r.id }}
                      className="flex items-center justify-between gap-4 hover:text-primary"
                    >
                      <div>
                        <p className="font-medium">{r.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {(r.financial_years as { label: string } | null)?.label} ·{" "}
                          {format(new Date(r.created_at), "d MMM yyyy")}
                        </p>
                      </div>
                      <Badge variant={r.status === "completed" ? "secondary" : "outline"}>
                        {r.status}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-sm text-muted-foreground">No document requests yet.</p>
            )}
          </CardContent>
        </Card>

        {hasPerm(user, "clients.assign") && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <UserPlus className="h-4 w-4" /> Assigned Team
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.members.length ? (
                <ul className="space-y-3">
                  {data.members.map((m) => {
                    const assigned = data.assignedIds.has(m.userId);
                    return (
                      <li key={m.userId} className="flex items-center gap-3">
                        <Checkbox
                          id={`assign-${m.userId}`}
                          checked={assigned}
                          onCheckedChange={() => toggleAssignment(m.userId, assigned)}
                        />
                        <label htmlFor={`assign-${m.userId}`} className="flex-1 cursor-pointer text-sm">
                          {m.name}
                          <span className="ml-2 text-xs capitalize text-muted-foreground">{m.role}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No managers or staff yet. Add them from the Team page.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

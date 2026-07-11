import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useCurrentUser, hasPerm } from "@/hooks/use-current-user";
import { createClientLogin } from "@/lib/team.functions";
import {
  getClientDetail,
  toggleAssignment,
  deleteClient,
  updateClient,
} from "@/lib/client-detail.functions";
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
import { ArrowLeft, KeyRound, Pencil, UserPlus } from "lucide-react";
import { format } from "date-fns";

const clientSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(150),
  pan: z.string().trim().max(10).optional().or(z.literal("")),
  gstin: z.string().trim().max(15).optional().or(z.literal("")),
  mobile: z.string().trim().max(15).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
});

export const Route = createFileRoute("/_authenticated/clients_/$clientId")({
  head: () => ({ meta: [{ title: "Client — CADesk" }] }),
  component: ClientDetailPage,
});

function ClientDetailPage() {
  const { clientId: clientIdParam } = Route.useParams();
  const clientId = Number(clientIdParam);
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const createLogin = useServerFn(createClientLogin);
  const fetchClientDetail = useServerFn(getClientDetail);
  const doToggleAssignment = useServerFn(toggleAssignment);
  const doDeleteClient = useServerFn(deleteClient);
  const doUpdateClient = useServerFn(updateClient);
  const [loginOpen, setLoginOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => fetchClientDetail({ data: { clientId } }),
  });

  const client = data?.client;

  const handleToggleAssignment = async (memberId: string, assigned: boolean) => {
    if (!client) return;
    try {
      await doToggleAssignment({
        data: {
          clientId,
          memberId,
          assigned,
          clientName: client.name,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update assignment");
    }
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

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!client) return;
    const form = new FormData(e.currentTarget);
    const parsed = clientSchema.safeParse({
      name: form.get("name"),
      pan: form.get("pan"),
      gstin: form.get("gstin"),
      mobile: form.get("mobile"),
      email: form.get("email"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setEditSaving(true);
    try {
      await doUpdateClient({
        data: { clientId, ...parsed.data },
      });
      toast.success("Client updated");
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update client");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!client) return;
    if (!confirm(`Delete client ${client.name}? This removes all their requests and documents.`)) return;
    try {
      await doDeleteClient({ data: { clientId, clientName: client.name } });
      toast.success("Client deleted");
      navigate({ to: "/clients" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete client");
    }
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
      {/* Page header banner */}
      <div className="rounded-lg px-6 py-5 mb-6 bg-white border-l-4 border-l-slate-700 border border-border shadow-sm flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h1 className="font-display text-2xl font-semibold">{client.name}</h1>
            <Badge
              variant="outline"
              className={client.portal_user_id
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-amber-50 text-amber-700 border-amber-200"}
            >
              {client.portal_user_id ? "Portal Active" : "No Portal"}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {client.pan && (
              <span><span className="text-xs uppercase tracking-wide mr-1">PAN</span><span className="font-medium text-foreground">{client.pan}</span></span>
            )}
            {client.gstin && (
              <span><span className="text-xs uppercase tracking-wide mr-1">GSTIN</span><span className="font-medium text-foreground">{client.gstin}</span></span>
            )}
            {client.mobile && (
              <span><span className="text-xs uppercase tracking-wide mr-1">Mobile</span><span className="font-medium text-foreground">{client.mobile}</span></span>
            )}
            {client.email && (
              <span><span className="text-xs uppercase tracking-wide mr-1">Email</span><span className="font-medium text-foreground">{client.email}</span></span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link to="/clients">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Link>
          </Button>
          {hasPerm(user, "clients.edit") && (
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Button>
          )}
          {!client.portal_user_id && hasPerm(user, "clients.edit") && (
            <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" size="sm">
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
            <Button variant="secondary" size="sm" onClick={handleDelete}>
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
                      params={{ requestId: String(r.id) }}
                      className="flex items-center justify-between gap-4 hover:text-primary"
                    >
                      <div>
                        <p className="font-medium">{r.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.fyLabel} ·{" "}
                          {format(new Date(r.created_at), "d MMM yyyy")}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          r.status === "completed"
                            ? "bg-green-100 text-green-700 border-green-200"
                            : r.status === "open"
                            ? "bg-blue-100 text-blue-700 border-blue-200"
                            : r.status === "archived"
                            ? "bg-amber-100 text-amber-700 border-amber-200"
                            : ""
                        }
                      >
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
                    const assigned = (data.assignedIds ?? []).includes(m.userId);
                    return (
                      <li key={m.userId} className="flex items-center gap-3">
                        <Checkbox
                          id={`assign-${m.userId}`}
                          checked={assigned}
                          onCheckedChange={() => handleToggleAssignment(m.userId, assigned)}
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

      {/* Edit client dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ed-name">Client name *</Label>
              <Input id="ed-name" name="name" required defaultValue={client.name} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ed-pan">PAN</Label>
                <Input id="ed-pan" name="pan" placeholder="ABCDE1234F" maxLength={10} defaultValue={client.pan ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ed-gstin">GSTIN</Label>
                <Input id="ed-gstin" name="gstin" maxLength={15} defaultValue={client.gstin ?? ""} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ed-mobile">Mobile</Label>
                <Input id="ed-mobile" name="mobile" defaultValue={client.mobile ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ed-email">Email</Label>
                <Input id="ed-email" name="email" type="email" defaultValue={client.email ?? ""} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={editSaving}>
              {editSaving ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

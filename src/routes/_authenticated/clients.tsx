import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useCurrentUser, hasPerm } from "@/hooks/use-current-user";
import { getClients, addClient } from "@/lib/clients.functions";
import { updateClient } from "@/lib/client-detail.functions";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { deleteClient } from "@/lib/client-detail.functions";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Clients — CADesk" }] }),
  component: ClientsPage,
});

const clientSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(150),
  pan: z.string().trim().max(10).optional().or(z.literal("")),
  gstin: z.string().trim().max(15).optional().or(z.literal("")),
  mobile: z.string().trim().max(15).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
});

type ClientRow = { id: number; name: string; pan: string | null; gstin: string | null; mobile: string | null; email: string | null; portal_user_id: string | null; created_at: string; updated_at: string; tenant_id: number };

function ClientsPage() {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchClients = useServerFn(getClients);
  const createClient = useServerFn(addClient);
  const doUpdateClient = useServerFn(updateClient);
  const doDeleteClient = useServerFn(deleteClient);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<ClientRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => fetchClients(),
  });

  const filtered = (clients ?? []).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [c.name, c.pan, c.gstin, c.mobile, c.email]
      .filter(Boolean)
      .some((v) => (v as string).toLowerCase().includes(q));
  });

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user?.tenantId) return;
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
    setSaving(true);
    try {
      await createClient({
        data: {
          name: parsed.data.name,
          pan: parsed.data.pan,
          gstin: parsed.data.gstin,
          mobile: parsed.data.mobile,
          email: parsed.data.email,
        },
      });
      toast.success("Client added");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add client");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editTarget) return;
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
        data: {
          clientId: editTarget.id,
          name: parsed.data.name,
          pan: parsed.data.pan,
          gstin: parsed.data.gstin,
          mobile: parsed.data.mobile,
          email: parsed.data.email,
        },
      });
      toast.success("Client updated");
      setEditTarget(null);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update client");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (c: ClientRow) => {
    if (!confirm(`Delete client "${c.name}"? This removes all their requests and documents.`)) return;
    try {
      await doDeleteClient({ data: { clientId: c.id, clientName: c.name } });
      toast.success("Client deleted");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete client");
    }
  };

  return (
    <AppShell>
      {/* Page header banner */}
      <div className="rounded-lg px-6 py-5 mb-6 bg-white border-l-4 border-l-slate-700 border border-border shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Clients</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            {user?.isCaAdmin ? "All clients in your firm" : "Clients assigned to you"}
          </p>
        </div>
        {hasPerm(user, "clients.add") && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary">
                <Plus className="mr-2 h-4 w-4" /> Add Client
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Client</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="c-name">Client name *</Label>
                  <Input id="c-name" name="name" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="c-pan">PAN</Label>
                    <Input id="c-pan" name="pan" placeholder="ABCDE1234F" maxLength={10} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="c-gstin">GSTIN</Label>
                    <Input id="c-gstin" name="gstin" maxLength={15} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="c-mobile">Mobile</Label>
                    <Input id="c-mobile" name="mobile" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="c-email">Email</Label>
                    <Input id="c-email" name="email" type="email" />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? "Saving…" : "Add Client"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, PAN, GST, mobile, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>PAN</TableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Client Portal</TableHead>
              {(hasPerm(user, "clients.edit") || hasPerm(user, "clients.delete")) && (
                <TableHead className="w-20 text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  {search ? "No clients match your search." : "No clients yet. Add your first client to get started."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate({ to: "/clients/$clientId", params: { clientId: String(c.id) } })}
                >
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.pan ?? "—"}</TableCell>
                  <TableCell>{c.gstin ?? "—"}</TableCell>
                  <TableCell>{c.mobile ?? "—"}</TableCell>
                  <TableCell>
                    {c.portal_user_id ? (
                      <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Not set up</Badge>
                    )}
                  </TableCell>
                  {(hasPerm(user, "clients.edit") || hasPerm(user, "clients.delete")) && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {hasPerm(user, "clients.edit") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            onClick={(e) => { e.stopPropagation(); setEditTarget(c as ClientRow); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {hasPerm(user, "clients.delete") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={(e) => { e.stopPropagation(); handleDelete(c as ClientRow); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit client dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="e-name">Client name *</Label>
                <Input id="e-name" name="name" required defaultValue={editTarget.name} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="e-pan">PAN</Label>
                  <Input id="e-pan" name="pan" placeholder="ABCDE1234F" maxLength={10} defaultValue={editTarget.pan ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e-gstin">GSTIN</Label>
                  <Input id="e-gstin" name="gstin" maxLength={15} defaultValue={editTarget.gstin ?? ""} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="e-mobile">Mobile</Label>
                  <Input id="e-mobile" name="mobile" defaultValue={editTarget.mobile ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e-email">Email</Label>
                  <Input id="e-email" name="email" type="email" defaultValue={editTarget.email ?? ""} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={editSaving}>
                {editSaving ? "Saving…" : "Save changes"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

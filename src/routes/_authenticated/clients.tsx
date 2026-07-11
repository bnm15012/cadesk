import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, hasPerm } from "@/hooks/use-current-user";
import { logActivity } from "@/lib/activity";
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
import { Plus, Search } from "lucide-react";

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

function ClientsPage() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
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
    const { data, error } = await supabase
      .from("clients")
      .insert({
        tenant_id: user.tenantId,
        name: parsed.data.name,
        pan: parsed.data.pan ? parsed.data.pan.toUpperCase() : null,
        gstin: parsed.data.gstin ? parsed.data.gstin.toUpperCase() : null,
        mobile: parsed.data.mobile || null,
        email: parsed.data.email || null,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message.includes("row-level security") ? "You don't have permission to add clients" : error.message);
      return;
    }
    logActivity({
      tenantId: user.tenantId,
      userId: user.userId,
      action: `Added client ${parsed.data.name}`,
      entityType: "client",
      entityId: data.id,
    });
    toast.success("Client added");
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  };

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Clients</h1>
          <p className="mt-1 text-muted-foreground">
            {user?.isCaAdmin ? "All clients in your firm" : "Clients assigned to you"}
          </p>
        </div>
        {hasPerm(user, "clients.add") && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
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

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>PAN</TableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Portal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {search ? "No clients match your search." : "No clients yet. Add your first client to get started."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      to="/clients/$clientId"
                      params={{ clientId: c.id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>{c.pan ?? "—"}</TableCell>
                  <TableCell>{c.gstin ?? "—"}</TableCell>
                  <TableCell>{c.mobile ?? "—"}</TableCell>
                  <TableCell>
                    {c.portal_user_id ? (
                      <Badge variant="secondary">Active</Badge>
                    ) : (
                      <Badge variant="outline">Not set up</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, hasPerm } from "@/hooks/use-current-user";
import { logActivity } from "@/lib/activity";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FolderOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/requests")({
  head: () => ({ meta: [{ title: "Document Requests — PracticeVault" }] }),
  component: RequestsPage,
});

function RequestsPage() {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clientId, setClientId] = useState("");
  const [fyId, setFyId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (user && user.isClient && !user.isFirmMember) {
      navigate({ to: "/portal", replace: true });
    }
  }, [user, navigate]);

  const canCreate = hasPerm(user, "documents.request");

  const { data: requests, isLoading } = useQuery({
    queryKey: ["requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_requests")
        .select("*, clients(name), financial_years(label), request_items(status)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: opts } = useQuery({
    queryKey: ["request-opts"],
    enabled: open,
    queryFn: async () => {
      const [c, f, t] = await Promise.all([
        supabase.from("clients").select("id, name").eq("is_active", true).order("name"),
        supabase.from("financial_years").select("id, label").eq("is_active", true).order("label", { ascending: false }),
        supabase.from("document_templates").select("id, name, template_items(id, name, category, sort_order, is_required, is_repeatable)"),
      ]);
      return { clients: c.data ?? [], years: f.data ?? [], templates: t.data ?? [] };
    },
  });

  const handleCreate = async () => {
    if (!user?.tenantId) return;
    if (!clientId || !fyId || !title.trim()) return void toast.error("Client, financial year and title are required");
    setBusy(true);
    const { data: req, error } = await supabase
      .from("document_requests")
      .insert({
        tenant_id: user.tenantId,
        client_id: clientId,
        financial_year_id: fyId,
        template_id: templateId || null,
        title: title.trim(),
        created_by: user.userId,
      })
      .select()
      .single();
    if (error || !req) {
      setBusy(false);
      return void toast.error(error?.message ?? "Failed");
    }
    if (templateId) {
      const tpl = (opts?.templates ?? []).find((t) => t.id === templateId);
      const items = (tpl?.template_items ?? []) as Array<{ name: string; category: string | null; sort_order: number; is_required: boolean; is_repeatable: boolean }>;
      if (items.length) {
        await supabase.from("request_items").insert(
          items.map((it) => ({
            request_id: req.id,
            tenant_id: user.tenantId!,
            name: it.name,
            category: it.category,
            sort_order: it.sort_order,
            is_required: it.is_required,
            is_repeatable: it.is_repeatable,
            status: "pending" as const,
          })),
        );
      }
    }
    logActivity({ tenantId: user.tenantId, userId: user.userId, action: `Created request "${title.trim()}"`, entityType: "request", entityId: req.id });
    setBusy(false);
    setOpen(false);
    setTitle(""); setClientId(""); setFyId(""); setTemplateId("");
    toast.success("Request created");
    qc.invalidateQueries({ queryKey: ["requests"] });
    navigate({ to: "/requests/$requestId", params: { requestId: req.id } });
  };

  const summary = (items: Array<{ status: string }>) => {
    const total = items.length;
    const approved = items.filter((i) => i.status === "approved").length;
    return `${approved}/${total} approved`;
  };

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Document Requests</h1>
          <p className="mt-1 text-muted-foreground">Track document collection and review across engagements.</p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> New Request</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Document Request</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. ITR filing FY 2024-25" />
                </div>
                <div className="space-y-2">
                  <Label>Client *</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      {(opts?.clients ?? []).map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Financial year *</Label>
                  <Select value={fyId} onValueChange={setFyId}>
                    <SelectTrigger><SelectValue placeholder="Select FY" /></SelectTrigger>
                    <SelectContent>
                      {(opts?.years ?? []).map((f) => (<SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Template (optional)</Label>
                  <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger><SelectValue placeholder="Start blank or pick template" /></SelectTrigger>
                    <SelectContent>
                      {(opts?.templates ?? []).map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreate} disabled={busy} className="w-full">{busy ? "Creating…" : "Create request"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (requests ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <FolderOpen className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No requests yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Create your first document request to start collecting files from clients.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>FY</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(requests ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link to="/requests/$requestId" params={{ requestId: r.id }} className="font-medium text-primary hover:underline">
                      {r.title}
                    </Link>
                  </TableCell>
                  <TableCell>{(r.clients as { name: string } | null)?.name ?? "—"}</TableCell>
                  <TableCell>{(r.financial_years as { label: string } | null)?.label ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{summary(r.request_items as unknown as { status: string }[])}</TableCell>
                  <TableCell><Badge variant={r.status === "completed" ? "default" : r.status === "archived" ? "outline" : "secondary"}>{r.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCurrentUser, hasPerm } from "@/hooks/use-current-user";
import { getRequests, getRequestOpts, createRequest } from "@/lib/requests.functions";
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
  head: () => ({ meta: [{ title: "Document Requests — CADesk" }] }),
  component: RequestsPage,
});

function RequestsPage() {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchRequests = useServerFn(getRequests);
  const fetchOpts = useServerFn(getRequestOpts);
  const doCreateRequest = useServerFn(createRequest);
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
    queryFn: () => fetchRequests(),
  });

  const { data: opts } = useQuery({
    queryKey: ["request-opts"],
    enabled: open,
    queryFn: () => fetchOpts(),
  });

  const handleCreate = async () => {
    if (!clientId || !fyId || !title.trim()) return void toast.error("Client, financial year and title are required");

    const selectedTemplate = opts?.templates.find((t) => t.id === Number(templateId));
    const tplItems = selectedTemplate?.template_items ?? [];

    setBusy(true);
    try {
      const result = await doCreateRequest({
        data: {
          title: title.trim(),
          clientId: Number(clientId),
          financialYearId: Number(fyId),
          templateId: templateId ? Number(templateId) : null,
          templateItems: tplItems.length > 0 ? tplItems : undefined,
        },
      });
      setBusy(false);
      setOpen(false);
      setTitle(""); setClientId(""); setFyId(""); setTemplateId("");
      toast.success("Request created");
      qc.invalidateQueries({ queryKey: ["requests"] });
      navigate({ to: "/requests/$requestId", params: { requestId: String(result.id) } });
    } catch (err) {
      setBusy(false);
      toast.error(err instanceof Error ? err.message : "Failed to create request");
    }
  };

  const summary = (items: Array<{ status: string }>) => {
    const total = items.length;
    const approved = items.filter((i) => i.status === "approved").length;
    return `${approved}/${total} approved`;
  };

  return (
    <AppShell>
      {/* Page header banner */}
      <div className="rounded-lg px-6 py-5 mb-6 bg-white border-l-4 border-l-slate-700 border border-border shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Document Requests</h1>
          <p className="mt-1 text-muted-foreground text-sm">Track and manage document collection</p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary"><Plus className="mr-2 h-4 w-4" /> New Request</Button>
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
                      {(opts?.clients ?? []).map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Financial year *</Label>
                  <Select value={fyId} onValueChange={setFyId}>
                    <SelectTrigger><SelectValue placeholder="Select FY" /></SelectTrigger>
                    <SelectContent>
                      {(opts?.years ?? []).map((f) => (<SelectItem key={f.id} value={String(f.id)}>{f.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Template (optional)</Label>
                  <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger><SelectValue placeholder="Start blank or pick template" /></SelectTrigger>
                    <SelectContent>
                      {(opts?.templates ?? []).map((t) => (<SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>))}
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
        <div className="rounded-lg border border-border bg-white">
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
                    <Link to="/requests/$requestId" params={{ requestId: String(r.id) }} className="font-medium text-primary hover:underline">
                      {r.title}
                    </Link>
                  </TableCell>
                  <TableCell>{r.clientName ?? "—"}</TableCell>
                  <TableCell>{r.fyLabel ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{summary(r.request_items)}</TableCell>
                  <TableCell>
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}

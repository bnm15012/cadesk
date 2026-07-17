import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentUser, hasPerm } from "@/hooks/use-current-user";
import { getTemplates, createTemplate } from "@/lib/templates.functions";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileStack, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/templates")({
  head: () => ({ meta: [{ title: "Templates — CA Vault" }] }),
  component: TemplatesPage,
});

export const DEFAULT_TEMPLATES: Array<{ name: string; description: string; items: Array<{ name: string; is_repeatable: boolean }> }> = [
  {
    name: "ITR — Salaried Individual",
    description: "Checklist for salaried income tax return",
    items: [
      { name: "Form 16 (from employer)", is_repeatable: false },
      { name: "Bank statements (all accounts)", is_repeatable: true },
      { name: "Investment proofs (80C — LIC, PPF, ELSS, etc.)", is_repeatable: true },
      { name: "Home loan interest certificate (if applicable)", is_repeatable: false },
      { name: "Rent receipts / Rental agreement (HRA, if applicable)", is_repeatable: true },
      { name: "Aadhaar copy", is_repeatable: false },
      { name: "PAN copy", is_repeatable: false },
    ],
  },
  {
    name: "GST Monthly Return",
    description: "Documents for monthly GSTR-1 and GSTR-3B filing",
    items: [
      { name: "Sales invoices", is_repeatable: true },
      { name: "Purchase invoices", is_repeatable: true },
      { name: "Credit / Debit notes", is_repeatable: true },
      { name: "Bank statement for the month", is_repeatable: true },
      { name: "Expense bills", is_repeatable: true },
    ],
  },
  {
    name: "Company Audit",
    description: "Statutory audit checklist for private limited company",
    items: [
      { name: "Bank statements (all accounts, full year)", is_repeatable: true },
      { name: "Trial balance", is_repeatable: false },
      { name: "Ledger extracts", is_repeatable: true },
      { name: "Fixed asset register", is_repeatable: false },
      { name: "Loan agreements", is_repeatable: true },
      { name: "Statutory dues challans (PF, ESI, TDS, GST)", is_repeatable: true },
      { name: "Board minutes / resolutions", is_repeatable: true },
    ],
  },
];

function TemplatesPage() {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchTemplates = useServerFn(getTemplates);
  const doCreateTemplate = useServerFn(createTemplate);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const canManage = hasPerm(user, "templates.manage");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: () => fetchTemplates(),
  });

  const filtered = (templates ?? []).filter((t) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || (t.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateTemplate = async (name: string, description: string, items: string[]) => {
    setBusy(true);
    try {
      await doCreateTemplate({
        data: { name, description: description || null, items: items.length > 0 ? items : undefined },
      });
      setBusy(false);
      setOpen(false);
      toast.success("Template created");
      qc.invalidateQueries({ queryKey: ["templates"] });
    } catch (err) {
      setBusy(false);
      toast.error(err instanceof Error ? err.message : "Failed to create template");
    }
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") || "").trim();
    if (!name) return void toast.error("Enter a template name");
    await handleCreateTemplate(name, String(form.get("description") || ""), []);
  };

  return (
    <AppShell>
      {/* Page header banner */}
      <div className="rounded-lg px-6 py-5 mb-6 bg-white border-l-4 border-l-slate-700 border border-border shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Templates</h1>
          <p className="mt-1 text-muted-foreground text-sm">Reusable document request templates</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> New Template</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Template</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="t-name">Name *</Label>
                  <Input id="t-name" name="name" required placeholder="e.g. ITR — Business" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-desc">Description</Label>
                  <Textarea id="t-desc" name="description" rows={3} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create template"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search templates…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (templates ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <FileStack className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No templates yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Create a checklist once, reuse it for every client engagement.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Description</TableHead>
                <TableHead className="w-20 text-center">Items</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No templates match your search.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((t, idx) => (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate({ to: "/templates/$templateId", params: { templateId: String(t.id) } })}
                  >
                    <TableCell className="text-center text-sm text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{t.description ?? "—"}</TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">{t.template_items.length}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}

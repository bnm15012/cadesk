import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, hasPerm } from "@/hooks/use-current-user";
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
import { Plus, FileStack, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/templates")({
  head: () => ({ meta: [{ title: "Templates — CADesk" }] }),
  component: TemplatesPage,
});

const STARTER_TEMPLATES: Array<{ name: string; description: string; items: string[] }> = [
  {
    name: "ITR — Salaried Individual",
    description: "Standard checklist for salaried income tax return",
    items: ["Form 16", "Bank statements (all)", "Investment proofs (80C)", "Home loan interest certificate", "Rent receipts", "Aadhaar copy", "PAN copy"],
  },
  {
    name: "GST Monthly Return",
    description: "Documents needed for monthly GSTR-1 / GSTR-3B filing",
    items: ["Sales invoices", "Purchase invoices", "Credit/Debit notes", "Bank statement", "Expense bills"],
  },
  {
    name: "Company Audit",
    description: "Statutory audit checklist for private limited company",
    items: ["Bank statements (all accounts)", "Trial balance", "Ledger extracts", "Fixed asset register", "Loan agreements", "Statutory dues challans", "Board minutes"],
  },
];

function TemplatesPage() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const canManage = hasPerm(user, "templates.manage");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_templates")
        .select("*, template_items(id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createTemplate = async (name: string, description: string, items: string[]) => {
    if (!user?.tenantId) return;
    setBusy(true);
    const { data: tpl, error } = await supabase
      .from("document_templates")
      .insert({ tenant_id: user.tenantId, name, description: description || null })
      .select()
      .single();
    if (error || !tpl) {
      setBusy(false);
      toast.error(error?.message ?? "Failed to create template");
      return;
    }
    if (items.length) {
      await supabase.from("template_items").insert(
        items.map((n, idx) => ({
          template_id: tpl.id,
          name: n,
          sort_order: idx,
          is_required: true,
          is_repeatable: false,
        })),
      );
    }
    setBusy(false);
    setOpen(false);
    toast.success("Template created");
    qc.invalidateQueries({ queryKey: ["templates"] });
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") || "").trim();
    if (!name) return void toast.error("Enter a template name");
    await createTemplate(name, String(form.get("description") || ""), []);
  };

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Document Templates</h1>
          <p className="mt-1 text-muted-foreground">
            Reusable checklists for common engagements — ITR, GST, audit, and more.
          </p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New Template
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Template</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="t-name">Name *</Label>
                  <Input id="t-name" name="name" required placeholder="e.g. ITR — Business" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-desc">Description</Label>
                  <Textarea id="t-desc" name="description" rows={3} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Creating…" : "Create template"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {canManage && (templates ?? []).length === 0 && !isLoading && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <p className="mb-3 text-sm font-medium">Get started with a starter template:</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {STARTER_TEMPLATES.map((s) => (
                <button
                  key={s.name}
                  onClick={() => createTemplate(s.name, s.description, s.items)}
                  disabled={busy}
                  className="rounded-lg border border-border p-4 text-left hover:border-primary hover:bg-accent"
                >
                  <p className="font-medium">{s.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.items.length} items</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (templates ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <FileStack className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No templates yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a checklist once, reuse it for every client engagement.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(templates ?? []).map((t) => (
            <Link key={t.id} to="/templates/$templateId" params={{ templateId: t.id }}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between pt-6">
                  <div>
                    <p className="font-display text-lg font-semibold">{t.name}</p>
                    {t.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {(t.template_items as unknown as { id: string }[]).length} items
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}

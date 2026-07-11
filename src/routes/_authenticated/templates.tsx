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
  head: () => ({ meta: [{ title: "Templates — CADesk" }] }),
  component: TemplatesPage,
});

export const DEFAULT_TEMPLATES: Array<{ name: string; description: string; items: string[] }> = [
  // ── Income Tax Returns ────────────────────────────────────────────────────
  {
    name: "ITR — Salaried Individual",
    description: "Standard checklist for salaried income tax return (ITR-1 / ITR-2)",
    items: [
      "Form 16 (from employer)",
      "Bank statements (all accounts)",
      "Investment proofs (80C — LIC, PPF, ELSS, etc.)",
      "Home loan interest certificate (80EE / 24b)",
      "Rent receipts / Rental agreement (HRA)",
      "Health insurance premium receipt (80D)",
      "NPS contribution proof (80CCD)",
      "Other income details (FD interest, dividends)",
      "Aadhaar copy",
      "PAN copy",
    ],
  },
  {
    name: "ITR — Business / Profession (44AD / 44ADA)",
    description: "Presumptive taxation for small business or professional (ITR-4)",
    items: [
      "PAN copy",
      "Aadhaar copy",
      "Bank statements (all business accounts)",
      "Gross turnover / gross receipts figure",
      "GST returns (if registered)",
      "Loan account statements",
      "Investment proofs (80C / 80D)",
      "Advance tax / self-assessment tax challans",
    ],
  },
  {
    name: "ITR — Business with Books (ITR-3)",
    description: "Regular business / profession requiring books of accounts",
    items: [
      "PAN copy",
      "Aadhaar copy",
      "Trading & Profit-Loss account",
      "Balance sheet",
      "Bank statements (all accounts)",
      "GST returns (GSTR-1 and GSTR-3B)",
      "TDS certificates (Form 26AS / AIS)",
      "Fixed asset details",
      "Loan account statements",
      "Investment proofs (80C / 80D)",
      "Advance tax / self-assessment tax challans",
    ],
  },
  {
    name: "ITR — Senior Citizen",
    description: "For individuals above 60 with pension and interest income",
    items: [
      "PAN copy",
      "Aadhaar copy",
      "Pension certificate / Form 16 from employer / pension authority",
      "Bank statements (all accounts)",
      "FD interest certificates (all banks)",
      "Health insurance premium receipt (80D — higher limit for senior citizens)",
      "Medical expenditure receipts (80D — no insurance)",
      "Investment proofs (80C)",
      "Form 26AS / AIS",
    ],
  },
  // ── GST ──────────────────────────────────────────────────────────────────
  {
    name: "GST — Monthly Return (GSTR-1 & 3B)",
    description: "Monthly filing for regular GST taxpayers (turnover > ₹1.5 Cr or opted out of QRMP)",
    items: [
      "Sales invoices (B2B with GST no., B2C)",
      "Purchase invoices",
      "Credit notes / Debit notes",
      "Bank statement for the month",
      "Expense bills (rent, telephone, utilities, etc.)",
      "Import / export invoices (if applicable)",
      "E-way bill details (if applicable)",
    ],
  },
  {
    name: "GST — Quarterly Return (QRMP Scheme)",
    description: "Quarterly filing for small taxpayers (turnover up to ₹5 Cr) under QRMP",
    items: [
      "Sales invoices for the quarter (B2B and B2C)",
      "Purchase invoices for the quarter",
      "Credit notes / Debit notes",
      "Bank statements (all 3 months)",
      "Expense bills for the quarter",
      "Monthly tax payment challans (PMT-06, if paid monthly)",
    ],
  },
  {
    name: "GST — Annual Return (GSTR-9)",
    description: "Year-end reconciliation and annual return for regular taxpayers",
    items: [
      "All 12 months GSTR-1 filed copies",
      "All 12 months GSTR-3B filed copies",
      "Audited financials (P&L and Balance sheet)",
      "GSTR-2A / 2B reconciliation statement",
      "ITC register (purchase register for the year)",
      "HSN-wise summary of supplies",
      "List of advances received and adjusted",
      "RCM (Reverse Charge Mechanism) details",
    ],
  },
  // ── Audit ─────────────────────────────────────────────────────────────────
  {
    name: "Tax Audit (Section 44AB)",
    description: "Tax audit report for businesses / professionals exceeding turnover threshold",
    items: [
      "Audited P&L and Balance sheet",
      "Bank statements (all accounts, full year)",
      "Trial balance",
      "Ledger extracts (major heads)",
      "Fixed asset register with depreciation",
      "Stock / inventory statement (opening and closing)",
      "Loan account statements",
      "TDS certificates received (Form 16A)",
      "TDS deducted details (salary, contractor, etc.)",
      "GST returns for all months",
      "Advance tax challans",
      "Previous year audit report (Form 3CA / 3CB)",
    ],
  },
  {
    name: "Company Statutory Audit (Pvt Ltd / Ltd)",
    description: "Statutory audit checklist under Companies Act 2013",
    items: [
      "Bank statements (all accounts, full year)",
      "Trial balance",
      "Ledger extracts",
      "Fixed asset register",
      "Stock statement (physical verification report)",
      "Debtors and creditors ageing list",
      "Loan agreements (secured and unsecured)",
      "Statutory dues challans (PF, ESI, TDS, GST, PT)",
      "Board minutes / resolutions",
      "Incorporation certificate and MoA/AoA",
      "Previous year financials",
      "ROC filings (MGT-7, AOC-4) of previous year",
    ],
  },
  {
    name: "LLP Audit",
    description: "Annual audit checklist for Limited Liability Partnerships",
    items: [
      "LLP agreement",
      "Bank statements (all accounts, full year)",
      "Trial balance",
      "Ledger extracts",
      "Fixed asset register",
      "Partners' capital account details",
      "Loan statements",
      "GST returns",
      "TDS returns",
      "Previous year financials",
      "Form 8 and Form 11 of previous year (ROC filings)",
    ],
  },
  // ── TDS ───────────────────────────────────────────────────────────────────
  {
    name: "TDS Return — Salary (24Q)",
    description: "Quarterly TDS return for salary deductions",
    items: [
      "Salary register / payroll summary for the quarter",
      "Employee PAN details",
      "Form 16 / investment declaration from employees",
      "TDS challan (ITNS 281) payment proofs",
      "Deductor PAN and TAN",
      "Previous quarter 24Q acknowledgement",
    ],
  },
  {
    name: "TDS Return — Non-Salary (26Q)",
    description: "Quarterly TDS return for contractor, rent, professional payments",
    items: [
      "Vendor / deductee PAN details",
      "Payment details (nature of payment, amount, TDS deducted)",
      "TDS challan (ITNS 281) payment proofs",
      "Invoices for payments made (contractor, rent, interest, professional fees)",
      "Deductor PAN and TAN",
      "Previous quarter 26Q acknowledgement",
    ],
  },
  // ── ROC / Company Compliance ──────────────────────────────────────────────
  {
    name: "ROC Annual Filing (Pvt Ltd — AOC-4 & MGT-7)",
    description: "Annual return and financial statement filing with MCA / ROC",
    items: [
      "Audited Balance sheet and P&L",
      "Auditor's report",
      "Director's report",
      "Board resolution for adoption of accounts",
      "List of directors with DIN and addresses",
      "List of shareholders with shareholding pattern",
      "MGT-8 (if applicable — listed company or ≥ 10 Cr paid-up capital)",
      "CIN (Corporate Identification Number)",
    ],
  },
  // ── Import / Export (EXIM) ────────────────────────────────────────────────
  {
    name: "Import / Export — EXIM Compliance",
    description: "Documents for businesses with import/export transactions",
    items: [
      "IEC (Import Export Code) certificate",
      "Shipping bills / Bill of lading",
      "Bill of entry (for imports)",
      "Foreign bank remittance advices (FIRC / eBRC)",
      "Letter of credit (if applicable)",
      "Customs duty payment challans",
      "GST refund claim (IGST on exports, if applicable)",
      "LUT / Bond (if exporting under LUT without paying IGST)",
      "Bank statement showing foreign currency receipts/payments",
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

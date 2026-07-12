import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentUser, hasPerm } from "@/hooks/use-current-user";
import {
  getFinancialYears,
  createFinancialYear,
  toggleFinancialYearActive,
} from "@/lib/financial-years.functions";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, CalendarRange } from "lucide-react";

export const Route = createFileRoute("/_authenticated/financial-years")({
  head: () => ({ meta: [{ title: "Financial Years — CA Vault" }] }),
  component: FinancialYearsPage,
});

function suggestNextFY(): { label: string; start: string; end: string } {
  const now = new Date();
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    label: `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`,
    start: `${startYear}-04-01`,
    end: `${startYear + 1}-03-31`,
  };
}

function FinancialYearsPage() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const fetchYears = useServerFn(getFinancialYears);
  const doCreate = useServerFn(createFinancialYear);
  const doToggle = useServerFn(toggleFinancialYearActive);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const suggestion = suggestNextFY();

  const { data: years, isLoading } = useQuery({
    queryKey: ["financial-years"],
    queryFn: () => fetchYears(),
  });

  const canManage = hasPerm(user, "settings.edit");

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const label = String(form.get("label")).trim();
    if (!label) return void toast.error("Enter a label");
    setBusy(true);
    try {
      await doCreate({
        data: {
          label,
          startDate: String(form.get("start")) || null,
          endDate: String(form.get("end")) || null,
        },
      });
      toast.success("Financial year added");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["financial-years"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      toast.error(msg.includes("duplicate") ? "This financial year already exists" : msg);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    try {
      await doToggle({ data: { id, isActive } });
      queryClient.invalidateQueries({ queryKey: ["financial-years"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  return (
    <AppShell>
      {/* Page header banner */}
      <div className="rounded-lg px-6 py-5 mb-6 bg-white border-l-4 border-l-slate-700 border border-border shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Financial Years</h1>
          <p className="mt-1 text-muted-foreground text-sm">Manage your firm's financial year periods</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Add Financial Year</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Financial Year</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fy-label">Label *</Label>
                  <Input id="fy-label" name="label" defaultValue={suggestion.label} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fy-start">Start date</Label>
                    <Input id="fy-start" name="start" type="date" defaultValue={suggestion.start} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fy-end">End date</Label>
                    <Input id="fy-end" name="end" type="date" defaultValue={suggestion.end} />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Adding…" : "Add financial year"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-lg border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Loading…</TableCell>
              </TableRow>
            ) : (years ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <CalendarRange className="h-8 w-8 text-muted-foreground" />
                    <p className="font-medium">No financial years yet</p>
                    <p className="text-sm">Add {suggestion.label} to start creating document requests.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              (years ?? []).map((fy, idx) => (
                <TableRow key={fy.id}>
                  <TableCell className="text-center text-sm text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="font-semibold">{fy.label}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fy.start_date ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fy.end_date ?? "—"}</TableCell>
                  <TableCell>
                    {canManage ? (
                      <button onClick={() => toggleActive(fy.id, fy.is_active)} title="Click to toggle status">
                        <Badge variant="outline" className={fy.is_active
                          ? "bg-green-50 text-green-700 border-green-200 cursor-pointer hover:bg-green-100"
                          : "bg-gray-50 text-gray-500 border-gray-200 cursor-pointer hover:bg-gray-100"
                        }>
                          {fy.is_active ? "Active" : "Archived"}
                        </Badge>
                      </button>
                    ) : (
                      <Badge variant="outline" className={fy.is_active
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-gray-50 text-gray-500 border-gray-200"
                      }>
                        {fy.is_active ? "Active" : "Archived"}
                      </Badge>
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

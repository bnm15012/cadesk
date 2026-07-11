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
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, CalendarRange } from "lucide-react";

export const Route = createFileRoute("/_authenticated/financial-years")({
  head: () => ({ meta: [{ title: "Financial Years — CADesk" }] }),
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
      <div className="rounded-lg px-6 py-5 mb-6 bg-white border-l-4 border-l-slate-700 border border-border shadow-sm">
        <h1 className="font-display text-2xl font-semibold">Financial Years</h1>
        <p className="mt-1 text-muted-foreground text-sm">Manage your firm's financial year periods</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-end gap-4">
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Financial Year
              </Button>
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

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (years ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <CalendarRange className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No financial years yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add {suggestion.label} to start creating document requests.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(years ?? []).map((fy) => (
            <Card key={fy.id}>
              <CardContent className="flex items-center justify-between pt-6">
                <div>
                  <p className="font-display text-xl font-semibold">{fy.label}</p>
                  {fy.start_date && fy.end_date && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {fy.start_date} → {fy.end_date}
                    </p>
                  )}
                </div>
                {canManage ? (
                  <button onClick={() => toggleActive(fy.id, fy.is_active)}>
                    <Badge variant={fy.is_active ? "secondary" : "outline"}>
                      {fy.is_active ? "Active" : "Archived"}
                    </Badge>
                  </button>
                ) : (
                  <Badge variant={fy.is_active ? "secondary" : "outline"}>
                    {fy.is_active ? "Active" : "Archived"}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}

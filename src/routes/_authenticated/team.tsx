import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentUser, hasPerm } from "@/hooks/use-current-user";
import { inviteTeamMember, removeTeamMember } from "@/lib/team.functions";
import { getTeam, toggleCustomRole } from "@/lib/team.data.functions";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team — CADesk" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const invite = useServerFn(inviteTeamMember);
  const remove = useServerFn(removeTeamMember);
  const fetchTeam = useServerFn(getTeam);
  const doToggleCustomRole = useServerFn(toggleCustomRole);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<"manager" | "staff">("staff");

  const { data: team, isLoading } = useQuery({
    queryKey: ["team"],
    queryFn: () => fetchTeam(),
  });

  const handleInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await invite({
        data: {
          fullName: String(form.get("fullName")),
          email: String(form.get("email")),
          password: String(form.get("password")),
          role,
        },
      });
      toast.success("Team member added. Share their login credentials securely.");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["team"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (memberUserId: string, name: string) => {
    if (!confirm(`Remove ${name} from your firm? Their login will be deleted.`)) return;
    try {
      await remove({ data: { memberUserId } });
      toast.success("Team member removed");
      queryClient.invalidateQueries({ queryKey: ["team"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  const handleToggleCustomRole = async (memberUserId: string, roleId: number, has: boolean) => {
    try {
      await doToggleCustomRole({ data: { memberUserId, roleId, has } });
      queryClient.invalidateQueries({ queryKey: ["team"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  return (
    <AppShell>
      {/* Page header banner */}
      <div className="rounded-lg px-6 py-5 mb-6 bg-white border-l-4 border-l-slate-700 border border-border shadow-sm">
        <h1 className="font-display text-2xl font-semibold">Team</h1>
        <p className="mt-1 text-muted-foreground text-sm">Manage your firm members</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-end gap-4">
        {hasPerm(user, "users.add") && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Team Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="t-name">Full name *</Label>
                  <Input id="t-name" name="fullName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-email">Email *</Label>
                  <Input id="t-email" name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-pass">Temporary password *</Label>
                  <Input id="t-pass" name="password" type="text" minLength={8} required />
                </div>
                <div className="space-y-2">
                  <Label>Role *</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as "manager" | "staff")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Adding…" : "Add member"}
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
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Base Role</TableHead>
              <TableHead>Custom Roles</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : (
              (team?.members ?? []).map((m) => {
                const isAdmin = m.baseRoles.includes("ca_admin");
                return (
                  <TableRow key={m.userId}>
                    <TableCell className="font-medium">
                      {m.profile?.full_name || "—"}
                      {m.userId === user?.userId && (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      )}
                    </TableCell>
                    <TableCell>{m.profile?.email}</TableCell>
                    <TableCell>
                      <Badge variant={isAdmin ? "default" : "secondary"} className="capitalize">
                        {isAdmin ? "Firm Admin" : m.baseRoles[0]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <span className="text-xs text-muted-foreground">All permissions</span>
                      ) : (team?.customRoles ?? []).length === 0 ? (
                        <span className="text-xs text-muted-foreground">No custom roles defined</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(team?.customRoles ?? []).map((cr) => {
                            const has = m.customRoleIds.includes(cr.id);
                            return (
                              <button
                                key={cr.id}
                                onClick={() =>
                                  hasPerm(user, "users.edit") && handleToggleCustomRole(m.userId, cr.id, has)
                                }
                                className="cursor-pointer"
                                title={has ? "Click to remove role" : "Click to grant role"}
                              >
                                <Badge variant={has ? "default" : "outline"}>{cr.name}</Badge>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {!isAdmin && hasPerm(user, "users.delete") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemove(m.userId, m.profile?.full_name ?? "member")}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}

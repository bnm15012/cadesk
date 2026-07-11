import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import {
  getRolesAndPermissions,
  createRole,
  togglePermission,
  deleteRole,
} from "@/lib/roles.functions";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Trash2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/roles")({
  head: () => ({ meta: [{ title: "Roles & Permissions — CADesk" }] }),
  component: RolesPage,
});

function RolesPage() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const fetchRoles = useServerFn(getRolesAndPermissions);
  const doCreateRole = useServerFn(createRole);
  const doTogglePermission = useServerFn(togglePermission);
  const doDeleteRole = useServerFn(deleteRole);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["roles-permissions"],
    queryFn: () => fetchRoles(),
  });

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name")).trim();
    if (name.length < 2) return void toast.error("Enter a role name");
    setBusy(true);
    try {
      await doCreateRole({
        data: {
          name,
          description: String(form.get("description") ?? "").trim() || null,
        },
      });
      toast.success("Role created");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["roles-permissions"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      toast.error(msg.includes("duplicate") ? "A role with this name already exists" : msg);
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePermission = async (roleId: number, permission: string, has: boolean) => {
    try {
      await doTogglePermission({ data: { roleId, permission, has } });
      queryClient.invalidateQueries({ queryKey: ["roles-permissions"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update permission");
    }
  };

  const handleDeleteRole = async () => {
    if (!deleteTarget) return;
    try {
      await doDeleteRole({ data: { roleId: deleteTarget.id, roleName: deleteTarget.name } });
      toast.success("Role deleted");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["roles-permissions"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete role");
    }
  };

  return (
    <AppShell>
      {/* Page header banner */}
      <div className="rounded-lg px-6 py-5 mb-6 bg-white border-l-4 border-l-slate-700 border border-border shadow-sm">
        <h1 className="font-display text-2xl font-semibold">Roles & Permissions</h1>
        <p className="mt-1 text-muted-foreground text-sm">Control what each role can do</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-end gap-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New Role
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Role</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="r-name">Role name *</Label>
                <Input id="r-name" name="name" placeholder="e.g. Senior Reviewer" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="r-desc">Description</Label>
                <Input id="r-desc" name="description" placeholder="What can this role do?" />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Creating…" : "Create role"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (data?.roles ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <ShieldCheck className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No custom roles yet</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Managers and staff have no permissions until you create roles and assign them. Firm
              admins always have full access.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {(data?.roles ?? []).map((role) => {
            const rolePerms = new Set(
              (data?.perms ?? []).filter((p) => p.role_id === role.id).map((p) => p.permission),
            );
            return (
              <Card key={role.id}>
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <CardTitle className="font-display text-lg">{role.name}</CardTitle>
                    {role.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ id: role.id, name: role.name })}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {PERMISSION_GROUPS.map((group) => (
                      <div key={group.group}>
                        <p className="mb-2 text-sm font-semibold">{group.group}</p>
                        <div className="space-y-2">
                          {group.permissions.map((perm) => {
                            const has = rolePerms.has(perm.key);
                            return (
                              <div key={perm.key} className="flex items-center gap-2">
                                <Checkbox
                                  id={`${role.id}-${perm.key}`}
                                  checked={has}
                                  onCheckedChange={() => handleTogglePermission(role.id, perm.key, has)}
                                />
                                <label
                                  htmlFor={`${role.id}-${perm.key}`}
                                  className="cursor-pointer text-sm text-muted-foreground"
                                >
                                  {perm.label}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete role "{deleteTarget?.name}"?</DialogTitle>
            <DialogDescription>
              Members currently holding this role will lose all its permissions. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteRole}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

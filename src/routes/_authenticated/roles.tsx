import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PERMISSION_GROUPS } from "@/lib/permissions";
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
} from "@/components/ui/dialog";
import { Plus, Trash2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/roles")({
  head: () => ({ meta: [{ title: "Roles & Permissions — CADesk" }] }),
  component: RolesPage,
});

function RolesPage() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["roles-permissions"],
    queryFn: async () => {
      const [roles, perms] = await Promise.all([
        supabase.from("roles").select("*").order("created_at"),
        supabase.from("role_permissions").select("*"),
      ]);
      return { roles: roles.data ?? [], perms: perms.data ?? [] };
    },
  });

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user?.tenantId) return;
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name")).trim();
    if (name.length < 2) return void toast.error("Enter a role name");
    setBusy(true);
    const { error } = await supabase.from("roles").insert({
      tenant_id: user.tenantId,
      name,
      description: String(form.get("description") ?? "").trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "A role with this name already exists" : error.message);
      return;
    }
    toast.success("Role created");
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["roles-permissions"] });
  };

  const togglePermission = async (roleId: string, permission: string, has: boolean) => {
    if (has) {
      const { error } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", roleId)
        .eq("permission", permission);
      if (error) return void toast.error(error.message);
    } else {
      const { error } = await supabase.from("role_permissions").insert({ role_id: roleId, permission });
      if (error) return void toast.error(error.message);
    }
    queryClient.invalidateQueries({ queryKey: ["roles-permissions"] });
  };

  const deleteRole = async (roleId: string, name: string) => {
    if (!confirm(`Delete role "${name}"? Members holding it will lose its permissions.`)) return;
    const { error } = await supabase.from("roles").delete().eq("id", roleId);
    if (error) return void toast.error(error.message);
    toast.success("Role deleted");
    queryClient.invalidateQueries({ queryKey: ["roles-permissions"] });
  };

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Roles & Permissions</h1>
          <p className="mt-1 text-muted-foreground">
            Create custom roles and grant granular permissions. Assign roles from the Team page.
          </p>
        </div>
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
                  <Button variant="ghost" size="icon" onClick={() => deleteRole(role.id, role.name)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
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
                                  onCheckedChange={() => togglePermission(role.id, perm.key, has)}
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
    </AppShell>
  );
}

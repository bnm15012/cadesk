import { useState } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, User, Building2, ShieldCheck, KeyRound } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { changePassword } from "@/lib/auth";
import { toast } from "sonner";

export function ProfileModal({
  open,
  defaultTab,
  onOpenChange,
}: {
  open: boolean;
  defaultTab: "profile" | "password";
  onOpenChange: (v: boolean) => void;
}) {
  const { data: user } = useCurrentUser();
  const doChangePassword = useServerFn(changePassword);
  const [busy, setBusy] = useState(false);

  const roleLabel = user?.isCaAdmin
    ? "CA Admin"
    : user?.roles?.includes("manager")
    ? "Manager"
    : user?.roles?.includes("staff")
    ? "Staff"
    : user?.isClient
    ? "Client"
    : "—";

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const next = String(form.get("next") || "").trim();
    const confirm = String(form.get("confirm") || "").trim();
    if (!next || !confirm) return void toast.error("All fields are required");
    if (next !== confirm) return void toast.error("New passwords do not match");
    if (next.length < 8) return void toast.error("Password must be at least 8 characters");
    setBusy(true);
    try {
      await doChangePassword({ data: { newPassword: next } });
      toast.success("Password changed successfully");
      (e.target as HTMLFormElement).reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Account</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue={defaultTab} key={defaultTab}>
          <TabsList className="w-full">
            <TabsTrigger value="profile" className="flex-1">Profile</TabsTrigger>
            <TabsTrigger value="password" className="flex-1">Change Password</TabsTrigger>
          </TabsList>

          {/* ── Profile tab ── */}
          <TabsContent value="profile" className="mt-4 space-y-4">
            {/* Avatar + name */}
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-semibold">
                {(user?.fullName || user?.email || "?")[0].toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="font-semibold truncate">{user?.fullName || "—"}</p>
                <p className="text-sm text-muted-foreground break-all">{user?.email}</p>
              </div>
            </div>

            <div className="divide-y divide-border rounded-lg border border-border">
              <div className="flex items-center gap-3 px-4 py-2.5">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm text-muted-foreground shrink-0 w-20">Full name</span>
                <span className="text-sm font-medium min-w-0 break-words">{user?.fullName || "—"}</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-2.5">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm text-muted-foreground shrink-0 w-20">Email</span>
                <span className="text-sm font-medium min-w-0 break-all">{user?.email || "—"}</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-2.5">
                <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm text-muted-foreground shrink-0 w-20">Role</span>
                <Badge variant="secondary">{roleLabel}</Badge>
              </div>
              {user?.tenantName && (
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground shrink-0 w-20">Firm</span>
                  <span className="text-sm font-medium min-w-0 break-words">{user.tenantName}</span>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Change password tab ── */}
          <TabsContent value="password" className="mt-4">
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cp-next">New password</Label>
                <Input id="cp-next" name="next" type="password" autoComplete="new-password" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-confirm">Confirm new password</Label>
                <Input id="cp-confirm" name="confirm" type="password" autoComplete="new-password" required />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                <KeyRound className="mr-2 h-4 w-4" />
                {busy ? "Updating…" : "Update password"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

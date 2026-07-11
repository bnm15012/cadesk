import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { Button } from "@/components/ui/button";
import { KeyRound, Mail, User, Building2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — CADesk" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: user } = useCurrentUser();
  const [changePassOpen, setChangePassOpen] = useState(false);

  const roleLabel = user?.isCaAdmin
    ? "CA Admin"
    : user?.roles?.includes("manager")
    ? "Manager"
    : user?.roles?.includes("staff")
    ? "Staff"
    : user?.isClient
    ? "Client"
    : "—";

  return (
    <AppShell>
      <ChangePasswordModal open={changePassOpen} onOpenChange={setChangePassOpen} />

      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold">Profile</h1>
        <p className="mt-1 text-muted-foreground">Your account details</p>
      </div>

      <div className="grid gap-6 max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-semibold">
                {(user?.fullName || user?.email || "?")[0].toUpperCase()}
              </span>
              <div>
                <p className="text-lg font-semibold">{user?.fullName || "—"}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <div className="divide-y divide-border rounded-lg border border-border">
              <div className="flex items-center gap-3 px-4 py-3">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm text-muted-foreground w-24">Full name</span>
                <span className="text-sm font-medium">{user?.fullName || "—"}</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm text-muted-foreground w-24">Email</span>
                <span className="text-sm font-medium">{user?.email || "—"}</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm text-muted-foreground w-24">Role</span>
                <Badge variant="secondary">{roleLabel}</Badge>
              </div>
              {user?.tenantName && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground w-24">Firm</span>
                  <span className="text-sm font-medium">{user.tenantName}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Security</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Password</p>
                <p className="text-xs text-muted-foreground">Update your account password</p>
              </div>
              <Button variant="outline" onClick={() => setChangePassOpen(true)}>
                <KeyRound className="mr-2 h-4 w-4" /> Change password
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

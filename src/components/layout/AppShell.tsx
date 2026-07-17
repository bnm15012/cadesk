import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  FileStack,
  CalendarRange,
  UserCog,
  ShieldCheck,
  History,
  CreditCard,
  FolderCheck,
  LogOut,
  Menu,
  MoreHorizontal,
  X,
  FileText,
  ChevronDown,
  UserCircle,
  KeyRound,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { signOut } from "@/lib/auth";
import { useCurrentUser, hasPerm } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProfileModal } from "@/components/ProfileModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  to: string;
  label: string;
  short?: string;
  icon: typeof LayoutDashboard;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState<"profile" | "password" | false>(false);

  const performSignOut = useServerFn(signOut);

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await performSignOut();
    await queryClient.invalidateQueries({ queryKey: ["current-user"] });
    navigate({ to: "/" });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading your workspace…</p>
      </div>
    );
  }

  const firmNav: NavItem[] = [];
  if (user?.isFirmMember) {
    firmNav.push({ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard });
    firmNav.push({ to: "/clients", label: "Clients", icon: Users });
    firmNav.push({ to: "/requests", label: "Document Requests", short: "Requests", icon: FolderOpen });
    firmNav.push({ to: "/templates", label: "Templates", icon: FileStack });
    // Financial Years are auto-managed — screen hidden from nav
    firmNav.push({ to: "/team", label: "Team", icon: UserCog });
    if (hasPerm(user, "settings.edit")) {
      firmNav.push({ to: "/roles", label: "Roles & Permissions", short: "Roles", icon: ShieldCheck });
    }
    firmNav.push({ to: "/activity", label: "Activity Log", short: "Activity", icon: History });
    if (user.isCaAdmin) {
      firmNav.push({ to: "/billing", label: "Billing", icon: CreditCard });
    }
  }
  if (user?.isClient) {
    firmNav.push({ to: "/portal", label: "My Documents", short: "Documents", icon: FileText });
  }

  const bottomNavItems = firmNav.slice(0, 4);
  const hasMoreItems = firmNav.length > bottomNavItems.length;

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {firmNav.map((item) => {
        const active = pathname === item.to || pathname.startsWith(item.to + "/");
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const sidebarHeader = (
    <div className="flex items-center gap-2 px-6 py-5">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
        <FolderCheck className="h-4 w-4" />
      </span>
      <span className="font-display text-lg font-semibold text-sidebar-accent-foreground">
        CA Vault
      </span>
    </div>
  );

  const userDropdown = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:bg-accent"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
            {(user?.fullName || user?.email || "?")[0].toUpperCase()}
          </span>
          <span className="hidden sm:block max-w-[140px] truncate">
            {user?.fullName || user?.email}
          </span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {/* Profile details */}
        <div className="px-3 py-3 space-y-1">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
              {(user?.fullName || user?.email || "?")[0].toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user?.fullName || "—"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          {user?.tenantName && (
            <p className="text-xs text-muted-foreground pt-1">
              Firm: <span className="font-medium text-foreground">{user.tenantName}</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Role: <span className="font-medium text-foreground capitalize">
              {user?.isCaAdmin ? "CA Admin" : user?.isClient ? "Client" : user?.roles?.[0] ?? "—"}
            </span>
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setProfileOpen("profile")}>
          <UserCircle className="mr-2 h-4 w-4" /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setProfileOpen("password")}>
          <KeyRound className="mr-2 h-4 w-4" /> Change password
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const sidebarFooter = null;

  return (
    <div className="flex min-h-screen bg-background">
      <ProfileModal
        open={!!profileOpen}
        defaultTab={profileOpen || "profile"}
        onOpenChange={(v) => setProfileOpen(v ? "profile" : false)}
      />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar lg:flex">
        {sidebarHeader}
        {nav}
      </aside>

      {/* Desktop top bar */}
      <div className="fixed inset-x-0 top-0 z-20 hidden h-14 items-center justify-end border-b border-border bg-background px-6 lg:flex lg:ml-64">
        {userDropdown}
      </div>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <FolderCheck className="h-4 w-4" />
          </span>
          <span className="font-display text-base font-semibold text-sidebar-accent-foreground">
            CA Vault
          </span>
        </div>
        {userDropdown}
      </div>

      {/* Mobile full menu overlay (opened from bottom "More") */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-sidebar lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                <Menu className="h-4 w-4" />
              </span>
              <span className="font-display text-base font-semibold text-sidebar-accent-foreground">
                Menu
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          {nav}
        </div>
      )}

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] lg:hidden">
        {bottomNavItems.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors",
                active
                  ? "text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.short ?? item.label}
            </Link>
          );
        })}
        {hasMoreItems && (
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium text-sidebar-foreground/60 transition-colors hover:text-sidebar-accent-foreground"
            aria-label="More options"
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </button>
        )}
      </nav>

      <main className="flex-1 pb-20 pt-14 lg:ml-64 lg:pb-0 lg:pt-14 bg-slate-50 min-h-screen">
        <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">{children}</div>
      </main>
    </div>
  );
}

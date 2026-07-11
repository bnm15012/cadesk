import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSession } from "@/lib/auth";

export interface CurrentUser {
  userId: string;
  email: string;
  fullName: string;
  tenantId: number | null;
  tenantName: string;
  tenantStatus: string;
  roles: string[];
  permissions: string[]; // ["*"] for CA admins
  clientId: number | null;
  isCaAdmin: boolean;
  isFirmMember: boolean;
  isClient: boolean;
  isSuperAdmin: boolean;
}

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;

  return {
    userId: session.userId,
    email: session.email,
    fullName: session.fullName,
    tenantId: session.tenantId,
    tenantName: "",        // loaded from tenants table via getSession if needed
    tenantStatus: session.tenantStatus ?? "active",
    roles: session.roles,
    permissions: session.permissions,
    clientId: session.clientId,
    isCaAdmin: session.isCaAdmin,
    isFirmMember: session.isFirmMember,
    isClient: session.isClient,
    isSuperAdmin: session.roles.includes("super_admin"),
  };
}

export function hasPerm(user: CurrentUser | null | undefined, permission: string): boolean {
  if (!user) return false;
  return user.permissions.includes("*") || user.permissions.includes(permission);
}

export function useCurrentUser() {
  const fetchSession = useServerFn(getSession);
  return useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const session = await fetchSession();
      if (!session) return null;
      return {
        userId: session.userId,
        email: session.email,
        fullName: session.fullName,
        tenantId: session.tenantId,
        tenantName: session.tenantName ?? "",
        tenantStatus: session.tenantStatus ?? "active",
        roles: session.roles,
        permissions: session.permissions,
        clientId: session.clientId,
        isCaAdmin: session.isCaAdmin,
        isFirmMember: session.isFirmMember,
        isClient: session.isClient,
        isSuperAdmin: session.roles.includes("super_admin"),
      } as CurrentUser;
    },
    staleTime: 60_000,
  });
}

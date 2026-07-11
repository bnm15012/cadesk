import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CurrentUser {
  userId: string;
  email: string;
  fullName: string;
  tenantId: string | null;
  tenantName: string;
  tenantStatus: string;
  roles: string[];
  permissions: string[]; // ["*"] for CA admins
  clientId: string | null;
  isCaAdmin: boolean;
  isFirmMember: boolean;
  isClient: boolean;
  isSuperAdmin: boolean;
}

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileRes, rolesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email, tenant_id, tenants(name, status)")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  const roles = (rolesRes.data ?? []).map((r) => r.role as string);
  const isCaAdmin = roles.includes("ca_admin");
  const isSuperAdmin = roles.includes("super_admin");
  const isFirmMember = roles.some((r) => ["ca_admin", "manager", "staff"].includes(r));
  const isClient = roles.includes("client");

  let permissions: string[] = [];
  if (isCaAdmin || isSuperAdmin) {
    permissions = ["*"];
  } else if (isFirmMember) {
    const { data: ucr } = await supabase
      .from("user_custom_roles")
      .select("role_id")
      .eq("user_id", user.id);
    if (ucr && ucr.length > 0) {
      const { data: perms } = await supabase
        .from("role_permissions")
        .select("permission")
        .in(
          "role_id",
          ucr.map((r) => r.role_id),
        );
      permissions = [...new Set((perms ?? []).map((p) => p.permission))];
    }
  }

  let clientId: string | null = null;
  if (isClient) {
    const { data: c } = await supabase
      .from("clients")
      .select("id")
      .eq("portal_user_id", user.id)
      .maybeSingle();
    clientId = c?.id ?? null;
  }

  const profile = profileRes.data;
  const tenant = (profile?.tenants ?? null) as { name: string; status: string } | null;

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? "",
    fullName: profile?.full_name ?? "",
    tenantId: profile?.tenant_id ?? null,
    tenantName: tenant?.name ?? "",
    tenantStatus: tenant?.status ?? "active",
    roles,
    permissions,
    clientId,
    isCaAdmin,
    isFirmMember,
    isClient,
    isSuperAdmin,
  };
}

export function hasPerm(user: CurrentUser | null | undefined, permission: string): boolean {
  if (!user) return false;
  return user.permissions.includes("*") || user.permissions.includes(permission);
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: fetchCurrentUser,
    staleTime: 60_000,
  });
}

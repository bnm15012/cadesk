/**
 * Server-side helpers replacing Supabase RPC calls:
 *   has_permission, has_role, get_user_tenant, can_access_request
 *
 * Only imported in server functions — never bundled into the client.
 */
import { eq, inArray } from "drizzle-orm";
import { getDb } from "./index";
import {
  clients,
  client_assignments,
  document_requests,
  profiles,
  role_permissions,
  user_custom_roles,
  user_roles,
} from "./schema";

/** Returns the tenant_id for a given user (replaces get_user_tenant RPC). */
export async function getUserTenant(userId: string): Promise<number | null> {
  const db = getDb();
  const rows = await db
    .select({ tenant_id: profiles.tenant_id })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return rows[0]?.tenant_id ?? null;
}

/** Returns true if the user holds the given system role (replaces has_role RPC). */
export async function hasRole(
  userId: string,
  role: "super_admin" | "ca_admin" | "manager" | "staff" | "client"
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ role: user_roles.role })
    .from(user_roles)
    .where(eq(user_roles.user_id, userId));
  return rows.some((r) => r.role === role);
}

/**
 * Returns true if the user has the given permission via any custom role
 * (replaces has_permission RPC).
 */
export async function hasPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  const db = getDb();
  const customRoles = await db
    .select({ role_id: user_custom_roles.role_id })
    .from(user_custom_roles)
    .where(eq(user_custom_roles.user_id, userId));
  if (customRoles.length === 0) return false;

  const roleIds = customRoles.map((r) => r.role_id);
  const perms = await db
    .select({ permission: role_permissions.permission })
    .from(role_permissions)
    .where(inArray(role_permissions.role_id, roleIds));

  return perms.some((p) => p.permission === permission);
}

/**
 * Returns true if the user can access the given document request:
 *   - Is a firm member assigned to the client, OR
 *   - Is the client portal user for that client
 * (replaces can_access_request RPC)
 */
export async function canAccessRequest(
  userId: string,
  requestId: number
): Promise<boolean> {
  const db = getDb();
  const reqRows = await db
    .select({ client_id: document_requests.client_id })
    .from(document_requests)
    .where(eq(document_requests.id, requestId))
    .limit(1);
  if (!reqRows[0]) return false;
  const { client_id } = reqRows[0];

  // Firm member assignment check
  const assignments = await db
    .select({ user_id: client_assignments.user_id })
    .from(client_assignments)
    .where(eq(client_assignments.client_id, client_id));
  if (assignments.some((a) => a.user_id === userId)) return true;

  // Portal user check
  const clientRow = await db
    .select({ portal_user_id: clients.portal_user_id })
    .from(clients)
    .where(eq(clients.id, client_id))
    .limit(1);
  return clientRow[0]?.portal_user_id === userId;
}

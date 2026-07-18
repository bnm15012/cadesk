/**
 * Server-side helpers replacing Supabase RPC calls:
 *   has_permission, has_role, get_user_tenant, can_access_request
 *
 * Only imported in server functions — never bundled into the client.
 */
import { count, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "./index";
import {
  clients,
  client_assignments,
  document_requests,
  document_templates,
  plans,
  profiles,
  role_permissions,
  subscriptions,
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

  // ca_admin and super_admin have all permissions
  const systemRoles = await db
    .select({ role: user_roles.role })
    .from(user_roles)
    .where(eq(user_roles.user_id, userId));
  if (systemRoles.some((r) => r.role === "ca_admin" || r.role === "super_admin")) {
    return true;
  }

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

/**
 * Checks whether a tenant has headroom under their plan limit for the given resource.
 * Throws a user-friendly error if the limit is reached.
 * limit=0 means unlimited.
 */
export async function checkPlanLimit(
  tenantId: number,
  resource: "clients" | "staff" | "templates"
): Promise<void> {
  const db = getDb();

  // Get latest subscription + plan limits
  const [sub] = await db
    .select({
      plan_name: plans.name,
      max_clients: plans.max_clients,
      max_staff: plans.max_staff,
      max_templates: plans.max_templates,
      status: subscriptions.status,
      current_period_end: subscriptions.current_period_end,
    })
    .from(subscriptions)
    .leftJoin(plans, eq(subscriptions.plan_id, plans.id))
    .where(eq(subscriptions.tenant_id, tenantId))
    .orderBy(desc(subscriptions.id))
    .limit(1);

  // No subscription at all → allow (e.g. super_admin seeding)
  if (!sub) return;

  // Treat as expired if: status is expired/cancelled OR period_end has passed
  const isExpired =
    sub.status === "expired" ||
    sub.status === "cancelled" ||
    (sub.current_period_end !== null && new Date(sub.current_period_end) < new Date());

  if (isExpired) {
    throw new Error(
      "Your plan has expired. Please renew from the Billing page to continue adding records."
    );
  }

  let limit = 0;
  let currentCount = 0;
  let label = "";

  if (resource === "clients") {
    limit = sub.max_clients ?? 0;
    if (limit === 0) return; // unlimited
    const [row] = await db.select({ c: count() }).from(clients).where(eq(clients.tenant_id, tenantId));
    currentCount = row?.c ?? 0;
    label = "clients";
  } else if (resource === "staff") {
    limit = sub.max_staff ?? 0;
    if (limit === 0) return;
    // Exclude ca_admin and client roles — only count manager + staff
    const allRoles = await db
      .select({ role: user_roles.role })
      .from(user_roles)
      .where(eq(user_roles.tenant_id, tenantId));
    currentCount = allRoles.filter((r) => r.role === "manager" || r.role === "staff").length;
    label = "team members";
  } else {
    limit = sub.max_templates ?? 0;
    if (limit === 0) return;
    const [row] = await db.select({ c: count() }).from(document_templates).where(eq(document_templates.tenant_id, tenantId));
    currentCount = row?.c ?? 0;
    label = "templates";
  }

  if (currentCount >= limit) {
    throw new Error(
      `You've reached your ${sub.plan_name ?? "current"} plan limit of ${limit} ${label}. Please upgrade your plan from the Billing page to add more.`
    );
  }
}

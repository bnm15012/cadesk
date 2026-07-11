/**
 * Server function called after Supabase Auth signup to bootstrap the new user
 * in MySQL. This replaces the Postgres `on_auth_user_created` trigger that
 * previously ran inside Supabase.
 *
 * Two flows:
 *  1. New firm signup (no tenant_id in metadata): create tenant, profile, ca_admin role, trial subscription
 *  2. Invited user (tenant_id present in metadata): create profile, assign role, optionally link client
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TRIAL_DAYS = 7;

/**
 * Returns the system roles for a given user from MySQL.
 * Used client-side after login to decide which route to redirect to.
 */
export const getUserRoles = createServerFn({ method: "GET" })
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data }) => {
    const { getDb } = await import("@/lib/db");
    const { user_roles } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await getDb()
      .select({ role: user_roles.role })
      .from(user_roles)
      .where(eq(user_roles.user_id, data.userId));
    return rows.map((r) => r.role);
  });

export const bootstrapNewUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      userId: string;
      email: string;
      fullName: string;
      firmName?: string;      // present for new firm signups
      tenantId?: number;      // present for invited users (int FK)
      appRole?: string;       // present for invited users
      clientId?: number;      // present when role === "client" (int FK)
      phone?: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const { getDb } = await import("@/lib/db");
    const {
      tenants,
      profiles,
      user_roles,
      subscriptions,
      clients,
    } = await import("@/lib/db/schema");

    const db = getDb();
    const now = new Date();

    if (data.tenantId) {
      // ── Invited user flow ──────────────────────────────────────────────────
      const role = (data.appRole ?? "staff") as
        | "ca_admin"
        | "manager"
        | "staff"
        | "client";

      await db.insert(profiles).values({
        id: data.userId,
        full_name: data.fullName,
        email: data.email,
        phone: data.phone ?? null,
        tenant_id: data.tenantId,
        created_at: now,
        updated_at: now,
      });

      await db.insert(user_roles).values({
        user_id: data.userId,
        role,
        tenant_id: data.tenantId,
      });

      // If client role, link the portal_user_id on the clients table
      if (role === "client" && data.clientId) {
        const { eq } = await import("drizzle-orm");
        await db
          .update(clients)
          .set({ portal_user_id: data.userId, updated_at: now })
          .where(eq(clients.id, data.clientId));
      }
    } else {
      // ── New firm signup flow ───────────────────────────────────────────────
      // Insert tenant and get back the auto-increment ID
      const [{ id: tenantId }] = await db.insert(tenants).values({
        name: data.firmName ?? `${data.fullName}'s Firm`,
        status: "active",
        created_at: now,
        updated_at: now,
      }).$returningId();

      await db.insert(profiles).values({
        id: data.userId,
        full_name: data.fullName,
        email: data.email,
        phone: data.phone ?? null,
        tenant_id: tenantId,
        created_at: now,
        updated_at: now,
      });

      await db.insert(user_roles).values({
        user_id: data.userId,
        role: "ca_admin",
        tenant_id: tenantId,
      });

      // 14-day trial subscription (no plan assigned yet)
      const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 86400000);
      await db.insert(subscriptions).values({
        tenant_id: tenantId,
        status: "trial",
        billing_period: "monthly",
        plan_id: null,
        current_period_start: now,
        current_period_end: trialEnd,
        created_at: now,
        updated_at: now,
      });
    }

    return { ok: true };
  });

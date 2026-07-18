import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { requireAuth } from "@/lib/auth-middleware";
import { getDb } from "@/lib/db";
import { clients, profiles, user_roles, users } from "@/lib/db/schema";
import { logActivity } from "@/lib/activity";
import { getUserTenant, hasPermission, checkPlanLimit } from "@/lib/db/helpers";

const BCRYPT_ROUNDS = 10;

const inviteTeamSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(100),
  fullName: z.string().trim().min(2).max(100),
  role: z.enum(["manager", "staff"]),
  phone: z.string().trim().max(20).optional(),
});

export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => inviteTeamSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const allowed = await hasPermission(userId, "users.add");
    if (!allowed) throw new Error("You do not have permission to add team members");

    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    await checkPlanLimit(tenantId, "staff");

    const db = getDb();
    const email = data.email.toLowerCase().trim();
    const now = new Date();

    // Check duplicate
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) throw new Error("A user with this email already exists");

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    const [result] = await db.insert(users).values({
      email,
      password_hash: passwordHash,
      full_name: data.fullName,
      email_confirmed: true,
      created_at: now,
      updated_at: now,
    });
    const newUserId = String((result as any).insertId);

    // Create profile
    await db.insert(profiles).values({
      id: newUserId,
      full_name: data.fullName,
      email,
      tenant_id: tenantId,
      created_at: now,
      updated_at: now,
    });

    // Assign role
    await db.insert(user_roles).values({
      user_id: newUserId,
      role: data.role,
      tenant_id: tenantId,
    });

    await logActivity({ tenantId, userId, action: `Added team member ${data.fullName} (${data.role})`, entityType: "user", entityId: newUserId });

    return { userId: newUserId };
  });

const clientLoginSchema = z.object({
  clientId: z.number().int().positive(),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(100),
});

export const createClientLogin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => clientLoginSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const allowed = await hasPermission(userId, "clients.edit");
    if (!allowed) throw new Error("You do not have permission to manage client logins");

    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();
    const email = data.email.toLowerCase().trim();
    const now = new Date();

    const clientRows = await db
      .select({ id: clients.id, name: clients.name, portal_user_id: clients.portal_user_id })
      .from(clients)
      .where(eq(clients.id, data.clientId))
      .limit(1);
    const client = clientRows[0];
    if (!client) throw new Error("Client not found");
    if (client.portal_user_id) throw new Error("This client already has a portal login");

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) throw new Error("A user with this email already exists");

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    const [result] = await db.insert(users).values({
      email,
      password_hash: passwordHash,
      full_name: client.name,
      email_confirmed: true,
      created_at: now,
      updated_at: now,
    });
    const newUserId = String((result as any).insertId);

    // Profile
    await db.insert(profiles).values({
      id: newUserId,
      full_name: client.name,
      email,
      tenant_id: tenantId,
      created_at: now,
      updated_at: now,
    });

    // Client role
    await db.insert(user_roles).values({
      user_id: newUserId,
      role: "client",
      tenant_id: tenantId,
    });

    // Link client record to portal user
    await db.update(clients).set({ portal_user_id: newUserId }).where(eq(clients.id, data.clientId));

    await logActivity({ tenantId, userId, action: `Created portal login for client ${client.name}`, entityType: "client", entityId: String(data.clientId) });

    return { userId: newUserId };
  });

const removeMemberSchema = z.object({ memberUserId: z.string() });

export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => removeMemberSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (data.memberUserId === userId) throw new Error("You cannot remove yourself");

    const allowed = await hasPermission(userId, "users.delete");
    if (!allowed) throw new Error("You do not have permission to remove team members");

    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();

    const [targetProfile] = await db
      .select({ tenant_id: profiles.tenant_id, full_name: profiles.full_name })
      .from(profiles)
      .where(eq(profiles.id, data.memberUserId))
      .limit(1);
    if (!targetProfile || targetProfile.tenant_id !== tenantId) {
      throw new Error("Team member not found in your firm");
    }

    const targetRoles = await db
      .select({ role: user_roles.role })
      .from(user_roles)
      .where(eq(user_roles.user_id, data.memberUserId));
    if (targetRoles.some((r) => r.role === "ca_admin")) {
      throw new Error("Firm admins cannot be removed");
    }

    // Delete user (cascades via FK: sessions, profiles, user_roles)
    await db.delete(user_roles).where(eq(user_roles.user_id, data.memberUserId));
    await db.delete(profiles).where(eq(profiles.id, data.memberUserId));
    await db.delete(users).where(eq(users.id, parseInt(data.memberUserId)));

    await logActivity({ tenantId, userId, action: `Removed team member ${targetProfile.full_name}`, entityType: "user", entityId: data.memberUserId });

    return { ok: true };
  });

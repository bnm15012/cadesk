import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getDb } from "@/lib/db";
import { activity_logs, clients, profiles, user_roles } from "@/lib/db/schema";
import { getUserTenant, hasPermission } from "@/lib/db/helpers";

const inviteTeamSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(100),
  fullName: z.string().trim().min(2).max(100),
  role: z.enum(["manager", "staff"]),
  phone: z.string().trim().max(20).optional(),
});

export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inviteTeamSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const allowed = await hasPermission(userId, "users.add");
    if (!allowed) throw new Error("You do not have permission to add team members");

    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
        phone: data.phone ?? null,
        tenant_id: tenantId,
        app_role: data.role,
      },
    });
    if (error) {
      throw new Error(
        error.message.includes("already been registered")
          ? "A user with this email already exists"
          : error.message,
      );
    }

    await getDb().insert(activity_logs).values({
      tenant_id: tenantId,
      user_id: userId,
      action: `Added team member ${data.fullName} (${data.role})`,
      entity_type: "user",
      entity_id: created.user.id,
      created_at: new Date(),
    });

    return { userId: created.user.id };
  });

const clientLoginSchema = z.object({
  clientId: z.number().int().positive(),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(100),
});

export const createClientLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => clientLoginSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const allowed = await hasPermission(userId, "clients.edit");
    if (!allowed) throw new Error("You do not have permission to manage client logins");

    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    // Verify the client belongs to this tenant (tenant-scoped read)
    const clientRows = await getDb()
      .select({ id: clients.id, name: clients.name, portal_user_id: clients.portal_user_id })
      .from(clients)
      .where(eq(clients.id, data.clientId))
      .limit(1);
    const client = clientRows[0];
    if (!client) throw new Error("Client not found");
    if (client.portal_user_id) throw new Error("This client already has a portal login");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: client.name,
        tenant_id: tenantId,
        app_role: "client",
        client_id: data.clientId,
      },
    });
    if (error) {
      throw new Error(
        error.message.includes("already been registered")
          ? "A user with this email already exists"
          : error.message,
      );
    }

    await getDb().insert(activity_logs).values({
      tenant_id: tenantId,
      user_id: userId,
      action: `Created portal login for client ${client.name}`,
      entity_type: "client",
      entity_id: String(data.clientId),
      created_at: new Date(),
    });

    return { userId: created.user.id };
  });

const removeMemberSchema = z.object({ memberUserId: z.string().uuid() });

export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => removeMemberSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (data.memberUserId === userId) throw new Error("You cannot remove yourself");

    const allowed = await hasPermission(userId, "users.delete");
    if (!allowed) throw new Error("You do not have permission to remove team members");

    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Confirm target belongs to the same tenant and is not a CA admin
    const profileRows = await getDb()
      .select({ tenant_id: profiles.tenant_id, full_name: profiles.full_name })
      .from(profiles)
      .where(eq(profiles.id, data.memberUserId))
      .limit(1);
    const targetProfile = profileRows[0];
    if (!targetProfile || targetProfile.tenant_id !== tenantId) {
      throw new Error("Team member not found in your firm");
    }

    const targetRoles = await getDb()
      .select({ role: user_roles.role })
      .from(user_roles)
      .where(eq(user_roles.user_id, data.memberUserId));
    if (targetRoles.some((r) => r.role === "ca_admin")) {
      throw new Error("Firm admins cannot be removed");
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.memberUserId);
    if (error) throw new Error(error.message);

    await getDb().insert(activity_logs).values({
      tenant_id: tenantId,
      user_id: userId,
      action: `Removed team member ${targetProfile.full_name}`,
      entity_type: "user",
      entity_id: data.memberUserId,
      created_at: new Date(),
    });

    return { ok: true };
  });

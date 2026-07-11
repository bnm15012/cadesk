import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    const { supabase, userId } = context;

    const { data: allowed } = await supabase.rpc("has_permission", {
      _user_id: userId,
      _permission: "users.add",
    });
    if (!allowed) throw new Error("You do not have permission to add team members");

    const { data: tenantId } = await supabase.rpc("get_user_tenant", { _user_id: userId });
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

    await supabaseAdmin.from("activity_logs").insert({
      tenant_id: tenantId,
      user_id: userId,
      action: `Added team member ${data.fullName} (${data.role})`,
      entity_type: "user",
      entity_id: created.user.id,
    });

    return { userId: created.user.id };
  });

const clientLoginSchema = z.object({
  clientId: z.string().uuid(),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(100),
});

export const createClientLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => clientLoginSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: allowed } = await supabase.rpc("has_permission", {
      _user_id: userId,
      _permission: "clients.edit",
    });
    if (!allowed) throw new Error("You do not have permission to manage client logins");

    const { data: tenantId } = await supabase.rpc("get_user_tenant", { _user_id: userId });
    if (!tenantId) throw new Error("No firm found for your account");

    // Verify the client belongs to this tenant (RLS-scoped read)
    const { data: client } = await supabase
      .from("clients")
      .select("id, name, portal_user_id")
      .eq("id", data.clientId)
      .maybeSingle();
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

    await supabaseAdmin.from("activity_logs").insert({
      tenant_id: tenantId,
      user_id: userId,
      action: `Created portal login for client ${client.name}`,
      entity_type: "client",
      entity_id: data.clientId,
    });

    return { userId: created.user.id };
  });

const removeMemberSchema = z.object({ memberUserId: z.string().uuid() });

export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => removeMemberSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.memberUserId === userId) throw new Error("You cannot remove yourself");

    const { data: allowed } = await supabase.rpc("has_permission", {
      _user_id: userId,
      _permission: "users.delete",
    });
    if (!allowed) throw new Error("You do not have permission to remove team members");

    const { data: tenantId } = await supabase.rpc("get_user_tenant", { _user_id: userId });
    if (!tenantId) throw new Error("No firm found for your account");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Confirm target belongs to the same tenant and is not a CA admin
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id, full_name")
      .eq("id", data.memberUserId)
      .maybeSingle();
    if (!targetProfile || targetProfile.tenant_id !== tenantId) {
      throw new Error("Team member not found in your firm");
    }
    const { data: targetRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.memberUserId);
    if ((targetRoles ?? []).some((r) => r.role === "ca_admin")) {
      throw new Error("Firm admins cannot be removed");
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.memberUserId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("activity_logs").insert({
      tenant_id: tenantId,
      user_id: userId,
      action: `Removed team member ${targetProfile.full_name}`,
      entity_type: "user",
      entity_id: data.memberUserId,
    });

    return { ok: true };
  });

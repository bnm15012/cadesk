import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-middleware";
import { getDb } from "@/lib/db";
import { profiles, roles, user_custom_roles, user_roles } from "@/lib/db/schema";
import { getUserTenant } from "@/lib/db/helpers";

export const getTeam = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();

    const [roleRows, customRoleRows, ucrRows] = await Promise.all([
      db
        .select({ user_id: user_roles.user_id, role: user_roles.role })
        .from(user_roles)
        .where(
          and(
            eq(user_roles.tenant_id, tenantId),
            inArray(user_roles.role, ["ca_admin", "manager", "staff"])
          )
        ),
      db
        .select({ id: roles.id, name: roles.name })
        .from(roles)
        .where(eq(roles.tenant_id, tenantId)),
      db
        .select({ user_id: user_custom_roles.user_id, role_id: user_custom_roles.role_id })
        .from(user_custom_roles),
    ]);

    const ids = [...new Set(roleRows.map((r) => r.user_id))];
    const profileRows = ids.length
      ? await db
          .select({
            id: profiles.id,
            full_name: profiles.full_name,
            email: profiles.email,
            phone: profiles.phone,
          })
          .from(profiles)
          .where(inArray(profiles.id, ids))
      : [];

    return {
      members: ids.map((id) => ({
        userId: id,
        profile: profileRows.find((p) => p.id === id) ?? null,
        baseRoles: roleRows.filter((r) => r.user_id === id).map((r) => r.role),
        customRoleIds: ucrRows.filter((u) => u.user_id === id).map((u) => u.role_id),
      })),
      customRoles: customRoleRows,
    };
  });

const toggleCustomRoleSchema = z.object({
  memberUserId: z.string(),
  roleId: z.number().int().positive(),
  has: z.boolean(),
});

export const toggleCustomRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => toggleCustomRoleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();

    if (data.has) {
      await db
        .delete(user_custom_roles)
        .where(
          and(
            eq(user_custom_roles.user_id, data.memberUserId),
            eq(user_custom_roles.role_id, data.roleId)
          )
        );
    } else {
      await db.insert(user_custom_roles).values({
        user_id: data.memberUserId,
        role_id: data.roleId,
      });
    }

    return { ok: true };
  });

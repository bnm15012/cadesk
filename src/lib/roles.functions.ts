import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-middleware";
import { getDb } from "@/lib/db";
import { role_permissions, roles, user_custom_roles } from "@/lib/db/schema";
import { getUserTenant } from "@/lib/db/helpers";

export const getRolesAndPermissions = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();

    const [roleRows, permRows] = await Promise.all([
      db
        .select()
        .from(roles)
        .where(eq(roles.tenant_id, tenantId))
        .orderBy(asc(roles.created_at)),
      db
        .select()
        .from(role_permissions),
    ]);

    return {
      roles: roleRows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        created_at: r.created_at.toISOString(),
      })),
      perms: permRows.map((p) => ({
        id: p.id,
        role_id: p.role_id,
        permission: p.permission,
      })),
    };
  });

const createRoleSchema = z.object({
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().optional().nullable(),
});

export const createRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => createRoleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();
    const now = new Date();

    const [result] = await db.insert(roles).values({
      tenant_id: tenantId,
      name: data.name,
      description: data.description || null,
      created_at: now,
    });

    return { id: (result as any).insertId as number };
  });

const togglePermSchema = z.object({
  roleId: z.number().int().positive(),
  permission: z.string(),
  has: z.boolean(),
});

export const togglePermission = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => togglePermSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();

    if (data.has) {
      await db
        .delete(role_permissions)
        .where(
          and(
            eq(role_permissions.role_id, data.roleId),
            eq(role_permissions.permission, data.permission)
          )
        );
    } else {
      await db.insert(role_permissions).values({
        role_id: data.roleId,
        permission: data.permission,
      });
    }

    return { ok: true };
  });

const deleteRoleSchema = z.object({
  roleId: z.number().int().positive(),
  roleName: z.string(),
});

export const deleteRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => deleteRoleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();

    // Delete child rows first to avoid FK constraint errors
    await db.delete(role_permissions).where(eq(role_permissions.role_id, data.roleId));
    await db.delete(user_custom_roles).where(eq(user_custom_roles.role_id, data.roleId));
    await db.delete(roles).where(and(eq(roles.id, data.roleId), eq(roles.tenant_id, tenantId)));

    return { ok: true };
  });

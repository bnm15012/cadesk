import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-middleware";
import { getDb } from "@/lib/db";
import { activity_logs, clients } from "@/lib/db/schema";
import { getUserTenant } from "@/lib/db/helpers";

export const getClients = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();
    const rows = await db
      .select()
      .from(clients)
      .where(eq(clients.tenant_id, tenantId))
      .orderBy(desc(clients.created_at));

    return rows.map((c) => ({
      ...c,
      created_at: c.created_at.toISOString(),
      updated_at: c.updated_at.toISOString(),
    }));
  });

const addClientSchema = z.object({
  name: z.string().trim().min(2).max(150),
  pan: z.string().trim().max(10).optional().or(z.literal("")),
  gstin: z.string().trim().max(15).optional().or(z.literal("")),
  mobile: z.string().trim().max(15).optional().or(z.literal("")),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
});

export const addClient = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => addClientSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();
    const now = new Date();

    const [result] = await db.insert(clients).values({
      tenant_id: tenantId,
      name: data.name,
      pan: data.pan ? data.pan.toUpperCase() : null,
      gstin: data.gstin ? data.gstin.toUpperCase() : null,
      mobile: data.mobile || null,
      email: data.email || null,
      created_at: now,
      updated_at: now,
    });

    const insertId = (result as any).insertId as number;

    await db.insert(activity_logs).values({
      tenant_id: tenantId,
      user_id: userId,
      action: `Added client ${data.name}`,
      entity_type: "client",
      entity_id: String(insertId),
      created_at: now,
    });

    return { id: insertId };
  });

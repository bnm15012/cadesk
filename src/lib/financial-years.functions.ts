import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-middleware";
import { getDb } from "@/lib/db";
import { financial_years } from "@/lib/db/schema";
import { getUserTenant } from "@/lib/db/helpers";

export const getFinancialYears = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();
    const rows = await db
      .select()
      .from(financial_years)
      .where(eq(financial_years.tenant_id, tenantId))
      .orderBy(desc(financial_years.label));

    return rows.map((fy) => ({
      id: fy.id,
      label: fy.label,
      start_date: fy.start_date ? fy.start_date.toISOString().slice(0, 10) : null,
      end_date: fy.end_date ? fy.end_date.toISOString().slice(0, 10) : null,
      is_active: fy.is_active,
    }));
  });

const createFYSchema = z.object({
  label: z.string().trim().min(1).max(50),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

export const createFinancialYear = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => createFYSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();
    const now = new Date();

    const [result] = await db.insert(financial_years).values({
      tenant_id: tenantId,
      label: data.label,
      start_date: data.startDate ? new Date(data.startDate) : null,
      end_date: data.endDate ? new Date(data.endDate) : null,
      created_at: now,
    });

    return { id: (result as any).insertId as number };
  });

const toggleFYSchema = z.object({
  id: z.number().int().positive(),
  isActive: z.boolean(),
});

export const toggleFinancialYearActive = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => toggleFYSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();

    await db
      .update(financial_years)
      .set({ is_active: !data.isActive })
      .where(eq(financial_years.id, data.id));

    return { ok: true };
  });

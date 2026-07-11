import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-middleware";
import { getDb } from "@/lib/db";
import { document_templates, template_items } from "@/lib/db/schema";
import { getUserTenant } from "@/lib/db/helpers";

export const getTemplates = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();

    const [tplRows, itemRows] = await Promise.all([
      db
        .select()
        .from(document_templates)
        .where(eq(document_templates.tenant_id, tenantId))
        .orderBy(desc(document_templates.created_at)),
      db.select({ id: template_items.id, template_id: template_items.template_id }).from(template_items),
    ]);

    return tplRows.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      created_at: t.created_at.toISOString(),
      template_items: itemRows.filter((i) => i.template_id === t.id).map((i) => ({ id: i.id })),
    }));
  });

const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().optional().nullable(),
  items: z.array(z.string()).optional(),
});

export const createTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => createTemplateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();
    const now = new Date();

    const [result] = await db.insert(document_templates).values({
      tenant_id: tenantId,
      name: data.name,
      description: data.description || null,
      created_at: now,
      updated_at: now,
    });

    const templateId = (result as any).insertId as number;

    if (data.items && data.items.length > 0) {
      await db.insert(template_items).values(
        data.items.map((name, idx) => ({
          template_id: templateId,
          name,
          sort_order: idx,
          is_required: true,
          is_repeatable: false,
        }))
      );
    }

    return { id: templateId };
  });

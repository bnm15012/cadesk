import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-middleware";
import { getDb } from "@/lib/db";
import { document_templates, template_items } from "@/lib/db/schema";
import { getUserTenant } from "@/lib/db/helpers";

export const getTemplate = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z.object({ templateId: z.number().int().positive() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();

    const [tplRows, itemRows] = await Promise.all([
      db
        .select()
        .from(document_templates)
        .where(
          and(
            eq(document_templates.id, data.templateId),
            eq(document_templates.tenant_id, tenantId)
          )
        )
        .limit(1),
      db
        .select()
        .from(template_items)
        .where(eq(template_items.template_id, data.templateId))
        .orderBy(asc(template_items.sort_order)),
    ]);

    const tpl = tplRows[0] ?? null;

    return {
      template: tpl
        ? {
            id: tpl.id,
            name: tpl.name,
            description: tpl.description,
            created_at: tpl.created_at.toISOString(),
          }
        : null,
      items: itemRows.map((it) => ({
        id: it.id,
        name: it.name,
        category: it.category,
        sort_order: it.sort_order,
        is_required: it.is_required,
        is_repeatable: it.is_repeatable,
      })),
    };
  });

const addItemSchema = z.object({
  templateId: z.number().int().positive(),
  name: z.string().trim().min(1),
  category: z.string().nullable(),
  sortOrder: z.number().int(),
});

export const addTemplateItem = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => addItemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();

    const [result] = await db.insert(template_items).values({
      template_id: data.templateId,
      name: data.name,
      category: data.category,
      sort_order: data.sortOrder,
      is_required: true,
      is_repeatable: false,
    });

    return { id: (result as any).insertId as number };
  });

const updateItemSchema = z.object({
  itemId: z.number().int().positive(),
  patch: z.object({
    name: z.string().optional(),
    category: z.string().nullable().optional(),
    is_required: z.boolean().optional(),
    is_repeatable: z.boolean().optional(),
    sort_order: z.number().optional(),
  }),
});

export const updateTemplateItem = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => updateItemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();

    await db
      .update(template_items)
      .set(data.patch)
      .where(eq(template_items.id, data.itemId));

    return { ok: true };
  });

const removeItemSchema = z.object({
  itemId: z.number().int().positive(),
});

export const removeTemplateItem = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => removeItemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();

    await db.delete(template_items).where(eq(template_items.id, data.itemId));

    return { ok: true };
  });

const updateTemplateSchema = z.object({
  templateId: z.number().int().positive(),
  patch: z.object({
    name: z.string().optional(),
    description: z.string().nullable().optional(),
  }),
});

export const updateTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => updateTemplateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();
    const now = new Date();

    await db
      .update(document_templates)
      .set({ ...data.patch, updated_at: now })
      .where(
        and(
          eq(document_templates.id, data.templateId),
          eq(document_templates.tenant_id, tenantId)
        )
      );

    return { ok: true };
  });

const deleteTemplateSchema = z.object({
  templateId: z.number().int().positive(),
});

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => deleteTemplateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();

    await db
      .delete(document_templates)
      .where(
        and(
          eq(document_templates.id, data.templateId),
          eq(document_templates.tenant_id, tenantId)
        )
      );

    return { ok: true };
  });

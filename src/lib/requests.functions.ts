import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-middleware";
import { getDb } from "@/lib/db";
import {
  activity_logs,
  clients,
  document_requests,
  document_templates,
  financial_years,
  request_items,
  template_items,
} from "@/lib/db/schema";
import { getUserTenant } from "@/lib/db/helpers";

export const getRequests = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();

    const [requestRows, clientRows, fyRows, itemRows] = await Promise.all([
      db
        .select({
          id: document_requests.id,
          title: document_requests.title,
          status: document_requests.status,
          created_at: document_requests.created_at,
          client_id: document_requests.client_id,
          financial_year_id: document_requests.financial_year_id,
        })
        .from(document_requests)
        .where(eq(document_requests.tenant_id, tenantId))
        .orderBy(desc(document_requests.created_at)),
      db
        .select({ id: clients.id, name: clients.name })
        .from(clients)
        .where(eq(clients.tenant_id, tenantId)),
      db
        .select({ id: financial_years.id, label: financial_years.label })
        .from(financial_years)
        .where(eq(financial_years.tenant_id, tenantId)),
      db
        .select({ request_id: request_items.request_id, status: request_items.status })
        .from(request_items)
        .where(eq(request_items.tenant_id, tenantId)),
    ]);

    const clientMap = new Map(clientRows.map((c) => [c.id, c.name]));
    const fyMap = new Map(fyRows.map((f) => [f.id, f.label]));

    return requestRows.map((r) => {
      const items = itemRows.filter((i) => i.request_id === r.id);
      return {
        id: r.id,
        title: r.title,
        status: r.status,
        created_at: r.created_at.toISOString(),
        clientName: clientMap.get(r.client_id) ?? null,
        fyLabel: fyMap.get(r.financial_year_id) ?? null,
        request_items: items.map((i) => ({ status: i.status })),
      };
    });
  });

export const getRequestOpts = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();

    const [clientRows, fyRows, tplRows, allTemplateItems] = await Promise.all([
      db
        .select({ id: clients.id, name: clients.name })
        .from(clients)
        .where(and(eq(clients.tenant_id, tenantId), eq(clients.is_active, true)))
        .orderBy(clients.name),
      db
        .select({ id: financial_years.id, label: financial_years.label })
        .from(financial_years)
        .where(and(eq(financial_years.tenant_id, tenantId), eq(financial_years.is_active, true)))
        .orderBy(desc(financial_years.label)),
      db
        .select({ id: document_templates.id, name: document_templates.name })
        .from(document_templates)
        .where(eq(document_templates.tenant_id, tenantId)),
      db
        .select()
        .from(template_items),
    ]);

    // Filter items to only those belonging to this tenant's templates
    const tplIds = new Set(tplRows.map((t) => t.id));

    return {
      clients: clientRows,
      years: fyRows,
      templates: tplRows.map((t) => ({
        id: t.id,
        name: t.name,
        template_items: allTemplateItems
          .filter((i) => tplIds.has(i.template_id) && i.template_id === t.id)
          .map((i) => ({
            id: i.id,
            name: i.name,
            category: i.category,
            sort_order: i.sort_order,
            is_required: i.is_required,
            is_repeatable: i.is_repeatable,
          })),
      })),
    };
  });

const createRequestSchema = z.object({
  title: z.string().trim().min(1).max(255),
  clientId: z.number().int().positive(),
  financialYearId: z.number().int().positive(),
  templateId: z.number().int().positive().nullable(),
  templateItems: z
    .array(
      z.object({
        name: z.string(),
        category: z.string().nullable(),
        sort_order: z.number(),
        is_required: z.boolean(),
        is_repeatable: z.boolean(),
      })
    )
    .optional(),
});

export const createRequest = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => createRequestSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();
    const now = new Date();

    const [result] = await db.insert(document_requests).values({
      tenant_id: tenantId,
      client_id: data.clientId,
      financial_year_id: data.financialYearId,
      template_id: data.templateId ?? null,
      title: data.title,
      created_by: userId,
      created_at: now,
      updated_at: now,
    });

    const requestId = (result as any).insertId as number;

    if (data.templateItems && data.templateItems.length > 0) {
      await db.insert(request_items).values(
        data.templateItems.map((it) => ({
          request_id: requestId,
          tenant_id: tenantId,
          name: it.name,
          category: it.category,
          sort_order: it.sort_order,
          is_required: it.is_required,
          is_repeatable: it.is_repeatable,
          status: "pending" as const,
          created_at: now,
          updated_at: now,
        }))
      );
    }

    await db.insert(activity_logs).values({
      tenant_id: tenantId,
      user_id: userId,
      action: `Created request "${data.title}"`,
      entity_type: "request",
      entity_id: String(requestId),
      created_at: now,
    });

    return { id: requestId };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-middleware";
import { getDb } from "@/lib/db";
import {
  activity_logs,
  clients,
  document_comments,
  document_files,
  document_requests,
  financial_years,
  profiles,
  request_items,
} from "@/lib/db/schema";
import { getUserTenant } from "@/lib/db/helpers";

export const getRequestDetail = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z.object({ requestId: z.number().int().positive() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();
    const { requestId } = data;

    const [reqRows, itemRows] = await Promise.all([
      db
        .select({
          id: document_requests.id,
          title: document_requests.title,
          status: document_requests.status,
          client_id: document_requests.client_id,
          financial_year_id: document_requests.financial_year_id,
          created_at: document_requests.created_at,
        })
        .from(document_requests)
        .where(
          and(
            eq(document_requests.id, requestId),
            eq(document_requests.tenant_id, tenantId)
          )
        )
        .limit(1),
      db
        .select()
        .from(request_items)
        .where(eq(request_items.request_id, requestId))
        .orderBy(asc(request_items.sort_order)),
    ]);

    const req = reqRows[0] ?? null;
    if (!req) return { request: null, items: [] };

    // Fetch client and FY names
    const [clientRows, fyRows] = await Promise.all([
      db
        .select({ id: clients.id, name: clients.name })
        .from(clients)
        .where(eq(clients.id, req.client_id))
        .limit(1),
      db
        .select({ id: financial_years.id, label: financial_years.label })
        .from(financial_years)
        .where(eq(financial_years.id, req.financial_year_id))
        .limit(1),
    ]);

    // Fetch document files for all items
    const itemIds = itemRows.map((i) => i.id);
    const fileRows = itemIds.length
      ? await db
          .select()
          .from(document_files)
          .where(inArray(document_files.request_item_id, itemIds))
      : [];

    return {
      request: {
        id: req.id,
        title: req.title,
        status: req.status,
        client_id: req.client_id,
        clientName: clientRows[0]?.name ?? null,
        fyLabel: fyRows[0]?.label ?? null,
        created_at: req.created_at.toISOString(),
      },
      items: itemRows.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        status: item.status,
        sort_order: item.sort_order,
        is_required: item.is_required,
        is_repeatable: item.is_repeatable,
        reviewed_by: item.reviewed_by,
        reviewed_at: item.reviewed_at ? item.reviewed_at.toISOString() : null,
        created_at: item.created_at.toISOString(),
        document_files: fileRows
          .filter((f) => f.request_item_id === item.id)
          .map((f) => ({
            id: f.id,
            storage_path: f.storage_path,
            file_name: f.file_name,
            file_size: f.file_size,
            created_at: f.created_at.toISOString(),
          })),
      })),
    };
  });

export const getComments = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z.object({ itemId: z.number().int().positive() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();

    const rows = await db
      .select()
      .from(document_comments)
      .where(
        and(
          eq(document_comments.request_item_id, data.itemId),
          eq(document_comments.tenant_id, tenantId)
        )
      )
      .orderBy(asc(document_comments.created_at));

    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const nameMap = new Map<string, string>();
    if (userIds.length) {
      const profs = await db
        .select({ id: profiles.id, full_name: profiles.full_name })
        .from(profiles)
        .where(inArray(profiles.id, userIds));
      profs.forEach((p) => nameMap.set(p.id, p.full_name));
    }

    return rows.map((r) => ({
      id: r.id,
      body: r.body,
      user_id: r.user_id,
      created_at: r.created_at.toISOString(),
      authorName: nameMap.get(r.user_id) ?? "User",
    }));
  });

const addItemSchema = z.object({
  requestId: z.number().int().positive(),
  name: z.string().trim().min(1),
  sortOrder: z.number().int(),
  isRepeatable: z.boolean().optional(),
});

export const addRequestItem = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => addItemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();
    const now = new Date();

    const [result] = await db.insert(request_items).values({
      request_id: data.requestId,
      tenant_id: tenantId,
      name: data.name,
      sort_order: data.sortOrder,
      is_required: true,
      is_repeatable: data.isRepeatable ?? false,
      status: "pending",
      created_at: now,
      updated_at: now,
    });

    return { id: (result as any).insertId as number };
  });

const updateItemStatusSchema = z.object({
  itemId: z.number().int().positive(),
  status: z.enum(["pending", "uploaded", "under_review", "approved", "rejected", "reupload_required"]),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional(),
});

export const updateItemStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => updateItemStatusSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();
    const now = new Date();

    await db
      .update(request_items)
      .set({
        status: data.status,
        reviewed_by: data.reviewedBy ?? null,
        reviewed_at: data.reviewedAt ? new Date(data.reviewedAt) : null,
        updated_at: now,
      })
      .where(eq(request_items.id, data.itemId));

    await db.insert(activity_logs).values({
      tenant_id: tenantId,
      user_id: userId,
      action: `Marked item as ${data.status}`,
      entity_type: "request_item",
      entity_id: String(data.itemId),
      created_at: now,
    });

    return { ok: true };
  });

const removeItemSchema = z.object({
  itemId: z.number().int().positive(),
});

export const removeRequestItem = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => removeItemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();

    await db
      .delete(request_items)
      .where(eq(request_items.id, data.itemId));

    return { ok: true };
  });

const insertDocFileSchema = z.object({
  requestItemId: z.number().int().positive(),
  storagePath: z.string(),
  fileName: z.string(),
  fileSize: z.number(),
  mimeType: z.string().nullable(),
  uploadedBy: z.string(),
});

export const insertDocumentFile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => insertDocFileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();
    const now = new Date();

    const [result] = await db.insert(document_files).values({
      request_item_id: data.requestItemId,
      tenant_id: tenantId,
      storage_path: data.storagePath,
      file_name: data.fileName,
      file_size: data.fileSize,
      mime_type: data.mimeType,
      uploaded_by: data.uploadedBy,
      created_at: now,
    });

    // Update item status to "uploaded"
    await db
      .update(request_items)
      .set({ status: "uploaded", updated_at: now })
      .where(eq(request_items.id, data.requestItemId));

    await db.insert(activity_logs).values({
      tenant_id: tenantId,
      user_id: userId,
      action: `Uploaded ${data.fileName}`,
      entity_type: "request_item",
      entity_id: String(data.requestItemId),
      created_at: now,
    });

    return { id: (result as any).insertId as number };
  });

const deleteDocFileSchema = z.object({
  fileId: z.number().int().positive(),
});

export const deleteDocumentFile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => deleteDocFileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();

    await db
      .delete(document_files)
      .where(
        and(
          eq(document_files.id, data.fileId),
          eq(document_files.tenant_id, tenantId)
        )
      );

    return { ok: true };
  });

const markCompletedSchema = z.object({
  requestId: z.number().int().positive(),
});

export const markRequestCompleted = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => markCompletedSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();
    const now = new Date();

    await db
      .update(document_requests)
      .set({ status: "completed", updated_at: now })
      .where(
        and(
          eq(document_requests.id, data.requestId),
          eq(document_requests.tenant_id, tenantId)
        )
      );

    await db.insert(activity_logs).values({
      tenant_id: tenantId,
      user_id: userId,
      action: "Marked request completed",
      entity_type: "request",
      entity_id: String(data.requestId),
      created_at: now,
    });

    return { ok: true };
  });

export const reopenRequest = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => z.object({ requestId: z.number().int().positive() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();
    const now = new Date();

    await db
      .update(document_requests)
      .set({ status: "open", updated_at: now })
      .where(
        and(
          eq(document_requests.id, data.requestId),
          eq(document_requests.tenant_id, tenantId)
        )
      );

    await db.insert(activity_logs).values({
      tenant_id: tenantId,
      user_id: userId,
      action: "Reopened request",
      entity_type: "request",
      entity_id: String(data.requestId),
      created_at: now,
    });

    return { ok: true };
  });

const addCommentSchema = z.object({
  requestItemId: z.number().int().positive(),
  body: z.string().trim().min(1),
});

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => addCommentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();
    const now = new Date();

    const [result] = await db.insert(document_comments).values({
      request_item_id: data.requestItemId,
      tenant_id: tenantId,
      user_id: userId,
      body: data.body,
      created_at: now,
    });

    return { id: (result as any).insertId as number };
  });

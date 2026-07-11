import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-middleware";
import { getDb } from "@/lib/db";
import {
  activity_logs,
  client_assignments,
  clients,
  document_requests,
  financial_years,
  profiles,
  user_roles,
} from "@/lib/db/schema";
import { getUserTenant } from "@/lib/db/helpers";

export const getClientDetail = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z.object({ clientId: z.number().int().positive() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();
    const { clientId } = data;

    const [clientRows, assignmentRows, memberRows, requestRows] =
      await Promise.all([
        db
          .select()
          .from(clients)
          .where(and(eq(clients.id, clientId), eq(clients.tenant_id, tenantId)))
          .limit(1),
        db
          .select({ user_id: client_assignments.user_id })
          .from(client_assignments)
          .where(
            and(
              eq(client_assignments.client_id, clientId),
              eq(client_assignments.tenant_id, tenantId)
            )
          ),
        db
          .select({ user_id: user_roles.user_id, role: user_roles.role })
          .from(user_roles)
          .where(
            and(
              eq(user_roles.tenant_id, tenantId),
              inArray(user_roles.role, ["manager", "staff"])
            )
          ),
        db
          .select({
            id: document_requests.id,
            title: document_requests.title,
            status: document_requests.status,
            created_at: document_requests.created_at,
            financial_year_id: document_requests.financial_year_id,
            client_id: document_requests.client_id,
          })
          .from(document_requests)
          .where(
            and(
              eq(document_requests.client_id, clientId),
              eq(document_requests.tenant_id, tenantId)
            )
          )
          .orderBy(desc(document_requests.created_at)),
      ]);

    const client = clientRows[0] ?? null;

    // Fetch profiles for members
    const memberIds = memberRows.map((m) => m.user_id);
    const profileRows = memberIds.length
      ? await db
          .select({ id: profiles.id, full_name: profiles.full_name })
          .from(profiles)
          .where(inArray(profiles.id, memberIds))
      : [];

    // Fetch financial year labels for requests
    const fyIds = [...new Set(requestRows.map((r) => r.financial_year_id))];
    const fyRows = fyIds.length
      ? await db
          .select({ id: financial_years.id, label: financial_years.label })
          .from(financial_years)
          .where(inArray(financial_years.id, fyIds))
      : [];
    const fyMap = new Map(fyRows.map((f) => [f.id, f.label]));

    return {
      client: client
        ? {
            ...client,
            created_at: client.created_at.toISOString(),
            updated_at: client.updated_at.toISOString(),
          }
        : null,
      assignedIds: assignmentRows.map((a) => a.user_id),
      members: memberRows.map((m) => ({
        userId: m.user_id,
        role: m.role,
        name:
          profileRows.find((p) => p.id === m.user_id)?.full_name ?? "Unknown",
      })),
      requests: requestRows.map((r) => ({
        ...r,
        created_at: r.created_at.toISOString(),
        fyLabel: fyMap.get(r.financial_year_id) ?? null,
      })),
    };
  });

const toggleAssignmentSchema = z.object({
  clientId: z.number().int().positive(),
  memberId: z.string(),
  assigned: z.boolean(),
  clientName: z.string(),
});

export const toggleAssignment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => toggleAssignmentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();
    const now = new Date();

    if (data.assigned) {
      await db
        .delete(client_assignments)
        .where(
          and(
            eq(client_assignments.client_id, data.clientId),
            eq(client_assignments.user_id, data.memberId)
          )
        );
    } else {
      await db.insert(client_assignments).values({
        tenant_id: tenantId,
        client_id: data.clientId,
        user_id: data.memberId,
        created_at: now,
      });
    }

    await db.insert(activity_logs).values({
      tenant_id: tenantId,
      user_id: userId,
      action: `${data.assigned ? "Unassigned" : "Assigned"} team member on client ${data.clientName}`,
      entity_type: "client",
      entity_id: String(data.clientId),
      created_at: now,
    });

    return { ok: true };
  });

const deleteClientSchema = z.object({
  clientId: z.number().int().positive(),
  clientName: z.string(),
});

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => deleteClientSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();
    const now = new Date();

    await db
      .delete(clients)
      .where(
        and(eq(clients.id, data.clientId), eq(clients.tenant_id, tenantId))
      );

    await db.insert(activity_logs).values({
      tenant_id: tenantId,
      user_id: userId,
      action: `Deleted client ${data.clientName}`,
      entity_type: "client",
      created_at: now,
    });

    return { ok: true };
  });

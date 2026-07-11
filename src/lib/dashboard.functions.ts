import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-middleware";
import { getDb } from "@/lib/db";
import {
  activity_logs,
  clients,
  document_requests,
  plans,
  request_items,
  subscriptions,
  user_roles,
} from "@/lib/db/schema";
import { getUserTenant } from "@/lib/db/helpers";

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const tenantId = await getUserTenant(userId);
    if (!tenantId) throw new Error("No firm found for your account");

    const db = getDb();

    const [clientRows, itemRows, staffRows, subRows, activityRows, pendingByClientRows, reviewByClientRows] =
      await Promise.all([
        db
          .select({ id: clients.id })
          .from(clients)
          .where(eq(clients.tenant_id, tenantId)),
        db
          .select({ status: request_items.status })
          .from(request_items)
          .where(eq(request_items.tenant_id, tenantId)),
        db
          .select({ id: user_roles.id, role: user_roles.role })
          .from(user_roles)
          .where(
            and(
              eq(user_roles.tenant_id, tenantId),
              inArray(user_roles.role, ["manager", "staff"])
            )
          ),
        db
          .select({
            id: subscriptions.id,
            status: subscriptions.status,
            current_period_end: subscriptions.current_period_end,
            plan_id: subscriptions.plan_id,
          })
          .from(subscriptions)
          .where(eq(subscriptions.tenant_id, tenantId))
          .orderBy(desc(subscriptions.created_at))
          .limit(1),
        db
          .select({
            id: activity_logs.id,
            action: activity_logs.action,
            created_at: activity_logs.created_at,
          })
          .from(activity_logs)
          .where(eq(activity_logs.tenant_id, tenantId))
          .orderBy(desc(activity_logs.created_at))
          .limit(10),
        // Pending uploads per client
        db
          .select({
            clientId: clients.id,
            clientName: clients.name,
            count: sql<number>`count(*)`.as("count"),
          })
          .from(request_items)
          .innerJoin(document_requests, eq(request_items.request_id, document_requests.id))
          .innerJoin(clients, eq(document_requests.client_id, clients.id))
          .where(
            and(
              eq(request_items.tenant_id, tenantId),
              inArray(request_items.status, ["pending", "reupload_required"])
            )
          )
          .groupBy(clients.id, clients.name)
          .orderBy(desc(sql`count(*)`)),
        // Pending reviews per client
        db
          .select({
            clientId: clients.id,
            clientName: clients.name,
            count: sql<number>`count(*)`.as("count"),
          })
          .from(request_items)
          .innerJoin(document_requests, eq(request_items.request_id, document_requests.id))
          .innerJoin(clients, eq(document_requests.client_id, clients.id))
          .where(
            and(
              eq(request_items.tenant_id, tenantId),
              inArray(request_items.status, ["uploaded", "under_review"])
            )
          )
          .groupBy(clients.id, clients.name)
          .orderBy(desc(sql`count(*)`)),
      ]);

    const statuses = itemRows.map((i) => i.status);

    // Resolve plan name if subscription exists
    let planName: string | null = null;
    const sub = subRows[0] ?? null;
    if (sub?.plan_id) {
      const [planRow] = await db
        .select({ name: plans.name })
        .from(plans)
        .where(eq(plans.id, sub.plan_id))
        .limit(1);
      planName = planRow?.name ?? null;
    }

    return {
      clientCount: clientRows.length,
      pendingUploads: statuses.filter(
        (s) => s === "pending" || s === "reupload_required"
      ).length,
      pendingReviews: statuses.filter(
        (s) => s === "uploaded" || s === "under_review"
      ).length,
      approved: statuses.filter((s) => s === "approved").length,
      staffCount: staffRows.length,
      subscription: sub
        ? {
            status: sub.status,
            current_period_end: sub.current_period_end
              ? sub.current_period_end.toISOString()
              : null,
            planName,
          }
        : null,
      activity: activityRows.map((a) => ({
        id: a.id,
        action: a.action,
        created_at: a.created_at.toISOString(),
      })),
      pendingUploadsByClient: pendingByClientRows.map((r) => ({
        clientId: r.clientId,
        clientName: r.clientName,
        count: Number(r.count),
      })),
      pendingReviewsByClient: reviewByClientRows.map((r) => ({
        clientId: r.clientId,
        clientName: r.clientName,
        count: Number(r.count),
      })),
    };
  });

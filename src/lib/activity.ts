import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { activity_logs } from "@/lib/db/schema";

const MAX_ACTIVITY_LOGS = 400;

/** Fire-and-forget activity logging. Never throws. Keeps last 400 per firm. */
export async function logActivity(params: {
  tenantId: number | string;
  userId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
}) {
  try {
    const db = getDb();
    const tenantId = Number(params.tenantId);

    await db.insert(activity_logs).values({
      tenant_id: tenantId,
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      details: params.details ?? {},
      created_at: new Date(),
    });

    // Keep only the latest 200 records per firm — delete oldest beyond that
    const [countRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(activity_logs)
      .where(eq(activity_logs.tenant_id, tenantId));

    if ((countRow?.count ?? 0) > MAX_ACTIVITY_LOGS) {
      const oldest = await db
        .select({ id: activity_logs.id })
        .from(activity_logs)
        .where(eq(activity_logs.tenant_id, tenantId))
        .orderBy(asc(activity_logs.created_at))
        .limit((countRow.count ?? 0) - MAX_ACTIVITY_LOGS);

      if (oldest.length > 0) {
        for (const row of oldest) {
          await db.delete(activity_logs).where(eq(activity_logs.id, row.id));
        }
      }
    }
  } catch (e) {
    console.error("activity log failed", e);
  }
}

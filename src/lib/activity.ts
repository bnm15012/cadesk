import { getDb } from "@/lib/db";
import { activity_logs } from "@/lib/db/schema";

/** Fire-and-forget activity logging. Never throws. */
export async function logActivity(params: {
  tenantId: number | string;
  userId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
}) {
  try {
    await getDb().insert(activity_logs).values({
      tenant_id: Number(params.tenantId),
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      details: params.details ?? {},
      created_at: new Date(),
    });
  } catch (e) {
    console.error("activity log failed", e);
  }
}

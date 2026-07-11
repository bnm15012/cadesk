import { supabase } from "@/integrations/supabase/client";

/** Fire-and-forget activity logging. Never throws. */
export async function logActivity(params: {
  tenantId: string;
  userId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
}) {
  try {
    await supabase.from("activity_logs").insert({
      tenant_id: params.tenantId,
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      details: (params.details ?? {}) as never,
    });
  } catch (e) {
    console.error("activity log failed", e);
  }
}

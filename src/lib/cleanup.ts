/**
 * Storage cleanup — runs automatically every 90 days on server startup.
 *
 * What it does:
 *   1. Checks DB for when cleanup last ran (system_settings key "storage_cleanup_last_run")
 *   2. If less than 90 days ago → skips (no-op)
 *   3. Otherwise → finds all document_files older than 90 days
 *   4. Deletes each file from Cloudflare R2
 *   5. Deletes the DB row
 *   6. Updates the last-run timestamp
 *
 * Triggered from server.ts on first incoming request — no cron needed.
 * Fire-and-forget: never throws, never blocks the request.
 */

import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { and, eq, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { document_files, system_settings } from "@/lib/db/schema";

const CLEANUP_INTERVAL_DAYS = 90;
const FILE_RETENTION_DAYS = 90;
const SETTING_KEY = "storage_cleanup_last_run";

let cleanupScheduled = false;

function getS3Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
}

function getBucket(): string | null {
  return process.env.R2_BUCKET_NAME ?? null;
}

async function doCleanup(): Promise<void> {
  const db = getDb();
  const s3 = getS3Client();
  const bucket = getBucket();

  if (!s3 || !bucket) {
    console.log("[cleanup] R2 not configured — skipping storage cleanup");
    return;
  }

  // Check when we last ran
  const [setting] = await db
    .select({ value: system_settings.value })
    .from(system_settings)
    .where(eq(system_settings.key, SETTING_KEY))
    .limit(1);

  if (setting?.value) {
    const lastRun = new Date(setting.value);
    const daysSinceLastRun = (Date.now() - lastRun.getTime()) / 86400000;
    if (daysSinceLastRun < CLEANUP_INTERVAL_DAYS) {
      console.log(`[cleanup] Last ran ${Math.floor(daysSinceLastRun)} days ago — skipping`);
      return;
    }
  }

  console.log("[cleanup] Starting storage cleanup — deleting files older than 90 days");

  const cutoff = new Date(Date.now() - FILE_RETENTION_DAYS * 86400000);

  // Fetch all files older than 90 days in batches of 100
  let deleted = 0;
  let errors = 0;

  const oldFiles = await db
    .select({ id: document_files.id, storage_path: document_files.storage_path })
    .from(document_files)
    .where(lt(document_files.created_at, cutoff));

  for (const file of oldFiles) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: file.storage_path }));
      await db.delete(document_files).where(eq(document_files.id, file.id));
      deleted++;
    } catch (e) {
      console.error(`[cleanup] Failed to delete file ${file.id} (${file.storage_path}):`, e);
      errors++;
    }
  }

  // Update last-run timestamp
  await db
    .insert(system_settings)
    .values({ key: SETTING_KEY, value: new Date().toISOString(), updated_at: new Date() })
    .onDuplicateKeyUpdate({ set: { value: new Date().toISOString(), updated_at: new Date() } });

  console.log(`[cleanup] Done — deleted ${deleted} files, ${errors} errors`);
}

/**
 * Call this once on server startup. Safe to call on every request —
 * it only runs the actual cleanup once per process lifetime (guard flag)
 * and then only if 90 days have passed since last DB-recorded run.
 */
export function scheduleStorageCleanup(): void {
  if (cleanupScheduled) return;
  cleanupScheduled = true;

  // Run async, completely detached — never blocks the incoming request
  setTimeout(() => {
    doCleanup().catch((e) => console.error("[cleanup] Unexpected error:", e));
  }, 5000); // 5s delay so server is fully initialised first
}

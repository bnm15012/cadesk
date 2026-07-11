/**
 * Cloudflare R2 (S3-compatible) storage helpers.
 *
 * All operations are server-side only — the browser never gets direct access
 * to R2 credentials. Instead:
 *   1. Client requests a presigned upload URL from the server
 *   2. Client uploads directly to R2 using that URL (no server bandwidth used)
 *   3. Client requests a presigned download URL to view/download a file
 *   4. Delete is done server-side only
 *
 * Required env vars (server-side only, no VITE_ prefix):
 *   R2_ACCOUNT_ID      — Cloudflare account ID
 *   R2_ACCESS_KEY_ID   — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret
 *   R2_BUCKET_NAME     — bucket name (e.g. "cadesk-documents")
 *   R2_PUBLIC_URL      — optional public bucket URL (if bucket is public)
 */
import { createServerFn } from "@tanstack/react-start";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function getS3() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in env.");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucket() {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME not configured.");
  return bucket;
}

// ── Get a presigned URL to upload a file directly from the browser ────────────
export const getUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    storagePath: string;   // e.g. "42/7/3/1720000000000_pan.pdf"
    contentType: string;   // e.g. "application/pdf"
    contentLength: number; // file size in bytes
  }) => d)
  .handler(async ({ data }) => {
    const s3 = getS3();
    const bucket = getBucket();

    // Max file size 50 MB
    if (data.contentLength > 50 * 1024 * 1024) {
      throw new Error("File too large. Maximum size is 50 MB.");
    }

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: data.storagePath,
      ContentType: data.contentType,
      ContentLength: data.contentLength,
    });

    // Presigned URL valid for 5 minutes
    const url = await getSignedUrl(s3, command, { expiresIn: 300 });
    return { url, storagePath: data.storagePath };
  });

// ── Get a presigned URL to download / view a file ────────────────────────────
export const getDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { storagePath: string; fileName: string }) => d)
  .handler(async ({ data }) => {
    const s3 = getS3();
    const bucket = getBucket();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: data.storagePath,
      ResponseContentDisposition: `attachment; filename="${data.fileName}"`,
    });

    // Presigned URL valid for 10 minutes
    const url = await getSignedUrl(s3, command, { expiresIn: 600 });
    return { url };
  });

// ── Delete a file from R2 ─────────────────────────────────────────────────────
export const deleteStorageFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { storagePath: string }) => d)
  .handler(async ({ data }) => {
    const s3 = getS3();
    const bucket = getBucket();

    await s3.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: data.storagePath,
    }));

    return { success: true };
  });

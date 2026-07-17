/**
 * Cloudflare R2 (S3-compatible) storage helpers.
 *
 * Upload strategy — two paths, tried in order:
 *   1. Presigned URL: browser PUTs directly to R2 (no server bandwidth used)
 *   2. Server proxy:  browser POSTs file to this server, server streams to R2
 *      (fallback when VPN/firewall blocks direct R2 connections)
 *
 * Required env vars (server-side only, no VITE_ prefix):
 *   R2_ACCOUNT_ID        — Cloudflare account ID
 *   R2_ACCESS_KEY_ID     — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret
 *   R2_BUCKET_NAME       — bucket name (e.g. "cavault")
 *   R2_PUBLIC_URL        — optional public bucket URL (if bucket is public)
 */
import { createServerFn } from "@tanstack/react-start";
import { S3Client, DeleteObjectCommand, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireAuth } from "@/lib/auth-middleware";

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
    forcePathStyle: true,
  });
}

function getBucket() {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME not configured.");
  return bucket;
}

// ── Get a presigned URL to upload a file directly from the browser ────────────
export const getUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: {
    storagePath: string;
    contentType: string;
    contentLength: number;
  }) => d)
  .handler(async ({ data }) => {
    const s3 = getS3();
    const bucket = getBucket();

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

// ── Proxy upload: browser sends file to this server, server streams to R2 ─────
// Used as fallback when VPN/firewall blocks direct browser→R2 connections.
export const proxyUploadFile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: {
    storagePath: string;
    contentType: string;
    fileBase64: string;
  }) => d)
  .handler(async ({ data }) => {
    const s3 = getS3();
    const bucket = getBucket();

    const buffer = Buffer.from(data.fileBase64, "base64");

    if (buffer.byteLength > 50 * 1024 * 1024) {
      throw new Error("File too large. Maximum size is 50 MB.");
    }

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: data.storagePath,
      ContentType: data.contentType,
      ContentLength: buffer.byteLength,
      Body: buffer,
    }));

    return { storagePath: data.storagePath };
  });

// ── Get a presigned URL to download / view a file ────────────────────────────
export const getDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: { storagePath: string; fileName: string }) => d)
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
  .middleware([requireAuth])
  .validator((d: { storagePath: string }) => d)
  .handler(async ({ data }) => {
    const s3 = getS3();
    const bucket = getBucket();

    await s3.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: data.storagePath,
    }));

    return { success: true };
  });

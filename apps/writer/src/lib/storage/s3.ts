import { S3Client } from "@aws-sdk/client-s3";
import { normalisePrefix } from "./recordingKeys";

/**
 * S3-compatible object storage (Cloudeka "kencana" for now; any S3 works).
 * Credentials only live on the server: the browser never talks to the
 * bucket, so the bucket needs no CORS rules and stays private.
 *
 *   S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
 *   S3_PREFIX (optional, e.g. "dev/"), S3_FORCE_PATH_STYLE (optional, "true")
 */

let client: S3Client | null = null;

export function s3Configured(): boolean {
  return Boolean(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}

export function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
      // Newer SDKs add CRC checksums to every request by default, which many
      // S3-compatible providers reject. Only send them when an API requires it.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return client;
}

export const s3Bucket = () => process.env.S3_BUCKET ?? "";
export const s3Prefix = () => normalisePrefix(process.env.S3_PREFIX);

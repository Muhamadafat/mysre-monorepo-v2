// Local-disk storage, replacing Supabase Storage buckets "uploads" and "screenshots".
import { createWriteStream, existsSync, mkdirSync } from "fs";
import { unlink } from "fs/promises";
import path from "path";

const PUBLIC_UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const PRIVATE_SCREENSHOTS_DIR = path.join(process.cwd(), "storage-private", "screenshots");

export async function saveUploadedFile(buffer: Buffer, filename: string): Promise<{ path: string; url: string }> {
  if (!existsSync(PUBLIC_UPLOADS_DIR)) mkdirSync(PUBLIC_UPLOADS_DIR, { recursive: true });

  const fullPath = path.join(PUBLIC_UPLOADS_DIR, filename);
  await new Promise<void>((resolve, reject) => {
    const writeStream = createWriteStream(fullPath);
    writeStream.on("finish", () => resolve());
    writeStream.on("error", reject);
    writeStream.end(buffer);
  });

  return { path: filename, url: `/uploads/${filename}` };
}

export async function saveScreenshot(buffer: Buffer, sessionId: string, filename: string): Promise<{ path: string }> {
  const dir = path.join(PRIVATE_SCREENSHOTS_DIR, sessionId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const relativePath = `${sessionId}/${filename}`;
  const fullPath = path.join(PRIVATE_SCREENSHOTS_DIR, relativePath);
  await new Promise<void>((resolve, reject) => {
    const writeStream = createWriteStream(fullPath);
    writeStream.on("finish", () => resolve());
    writeStream.on("error", reject);
    writeStream.end(buffer);
  });

  return { path: relativePath };
}

export function resolveScreenshotPath(relativePath: string): string {
  return path.join(PRIVATE_SCREENSHOTS_DIR, relativePath);
}

export async function deleteScreenshot(relativePath: string): Promise<void> {
  try {
    await unlink(resolveScreenshotPath(relativePath));
  } catch {
    // already gone, ignore
  }
}

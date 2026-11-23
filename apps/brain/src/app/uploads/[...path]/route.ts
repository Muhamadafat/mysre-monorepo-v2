import { readFile } from "fs/promises";
import path from "path";

/**
 * Serves files that brain saves to public/uploads at runtime (uploaded PDFs).
 * `next start` only serves public/ files that existed at build time, so
 * without this a freshly uploaded PDF falls through to the root layout,
 * which redirects to sign-in, and mcp-sre can't download it for analysis.
 */
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path ?? [];
  const fullPath = path.join(UPLOADS_DIR, ...parts);
  // Refuse anything that resolves outside the uploads folder (e.g. "..").
  if (!fullPath.startsWith(UPLOADS_DIR + path.sep)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const data = await readFile(fullPath);
    const type = CONTENT_TYPES[path.extname(fullPath).toLowerCase()] ?? "application/octet-stream";
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

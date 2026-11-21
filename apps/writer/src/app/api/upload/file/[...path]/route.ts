import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getServerSession } from "@sre-monorepo/lib/server";
import { isAdmin } from "@/lib/adminAuth";
import { keyFromImagePath } from "@/lib/storage/uploads";
import { s3, s3Bucket, s3Configured, s3Prefix } from "@/lib/storage/s3";

/**
 * GET /api/upload/file/<userId>/<projectId>/<uuid>.<ext> — an image from the
 * draft editor. Any signed-in writer (collaborators see each other's images)
 * or the admin page may read it; the name is a random UUID.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await getServerSession();
  if (!session?.user && !(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!s3Configured()) return NextResponse.json({ error: "Penyimpanan S3 belum diatur." }, { status: 500 });

  const target = keyFromImagePath(s3Prefix(), (await params).path ?? []);
  if (!target) return NextResponse.json({ error: "Gambar tidak ditemukan." }, { status: 404 });

  try {
    const object = await s3().send(new GetObjectCommand({ Bucket: s3Bucket(), Key: target.key }));
    if (!object.Body) throw new Error("empty body");
    return new Response(object.Body.transformToWebStream(), {
      headers: {
        "Content-Type": target.contentType,
        "Cache-Control": "private, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
        ...(object.ContentLength !== undefined ? { "Content-Length": String(object.ContentLength) } : {}),
      },
    });
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status !== 404) console.error("[upload/file] S3 read failed:", err);
    return NextResponse.json({ error: "Gambar tidak ditemukan." }, { status: 404 });
  }
}

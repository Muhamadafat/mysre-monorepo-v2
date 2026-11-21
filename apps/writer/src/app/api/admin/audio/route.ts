import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { fileSafe, findRecordingRow, stamp } from "@/lib/admin/data";
import { isUuid } from "@/lib/storage/recordingKeys";
import { s3, s3Bucket, s3Configured } from "@/lib/storage/s3";

/**
 * GET /api/admin/audio?id=<recording uuid>[&file=wav][&download=1]
 * Streams any student's recording for the admin (Range supported, so the
 * player can seek). Download name: <Nama>_<mode>_<timestamp>.mp3|wav.
 */
export async function GET(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Login peneliti dulu." }, { status: 401 });
  if (!s3Configured()) return NextResponse.json({ error: "Penyimpanan S3 belum diatur." }, { status: 500 });

  const params = new URL(request.url).searchParams;
  const id = params.get("id") ?? "";
  if (!isUuid(id)) return NextResponse.json({ error: "Id rekaman tidak valid." }, { status: 400 });
  const row = await findRecordingRow(id.toLowerCase()).catch(() => null);
  const wantWav = params.get("file") === "wav";
  const key = wantWav ? row?.wavKey : row?.audioKey;
  if (!row || !key) return NextResponse.json({ error: "Rekaman tidak ditemukan." }, { status: 404 });

  const range = request.headers.get("range") ?? undefined;
  try {
    const object = await s3().send(new GetObjectCommand({ Bucket: s3Bucket(), Key: key, Range: range }));
    if (!object.Body) throw new Error("empty body");
    const ext = key.split(".").pop() ?? (wantWav ? "wav" : "mp3");
    const headers: Record<string, string> = {
      "Content-Type": object.ContentType ?? (ext === "wav" ? "audio/wav" : "audio/mpeg"),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    };
    if (object.ContentLength !== undefined) headers["Content-Length"] = String(object.ContentLength);
    if (object.ContentRange) headers["Content-Range"] = object.ContentRange;
    if (params.get("download") === "1") {
      const name = `${fileSafe(row.user.name || row.user.email, "mahasiswa").replace(/ /g, "-")}_${row.mode}_${stamp(row.startedAt)}.${ext}`;
      headers["Content-Disposition"] = `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`;
    }
    return new Response(object.Body.transformToWebStream(), { status: object.ContentRange ? 206 : 200, headers });
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 416) return new Response(null, { status: 416 });
    if (status !== 404) console.error("[admin/audio] S3 read failed:", err);
    return NextResponse.json({ error: "File rekaman tidak ada di penyimpanan." }, { status: 404 });
  }
}

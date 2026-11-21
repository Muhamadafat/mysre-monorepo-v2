import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getServerSession } from "@sre-monorepo/lib/server";
import { findRecording } from "@/lib/storage/listRecordings";
import { isOwnRecordingKey, isUuid } from "@/lib/storage/recordingKeys";
import { s3, s3Bucket, s3Configured, s3Prefix } from "@/lib/storage/s3";

/**
 * Streams one recording from S3 (?uuid=<recording UUID>[&file=wav], or the
 * older ?key=<S3 audio key>) to its owner, passing the
 * Range header through so the player can seek; &download=1 saves it as a
 * file. Ownership comes from the key itself: every recording lives under
 * <S3_PREFIX><userId>/.
 */
export async function GET(request: Request) {
  const session = await getServerSession();
  const user = session?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!s3Configured()) {
    return NextResponse.json({ error: "Penyimpanan S3 belum diatur." }, { status: 500 });
  }

  const params = new URL(request.url).searchParams;
  const ref = params.get("uuid") ?? params.get("key") ?? "";
  let key = ref;
  if (isUuid(ref)) {
    // The recording's UUID (what the recordings API gives): main audio, or &file=wav for the original.
    const found = await findRecording(String(user.id), ref).catch(() => null);
    const wanted = params.get("file") === "wav" ? found?.meta.wavKey : found?.meta.audioKey;
    if (!wanted) return NextResponse.json({ error: "Rekaman tidak ditemukan." }, { status: 404 });
    key = wanted;
  }
  if (!isOwnRecordingKey(key, s3Prefix(), String(user.id))) {
    return NextResponse.json({ error: "Rekaman tidak ditemukan." }, { status: 404 });
  }

  const range = request.headers.get("range") ?? undefined;
  try {
    const object = await s3().send(new GetObjectCommand({ Bucket: s3Bucket(), Key: key, Range: range }));
    if (!object.Body) throw new Error("empty body");
    const headers: Record<string, string> = {
      "Content-Type": object.ContentType ?? "audio/mpeg",
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    };
    if (object.ContentLength !== undefined) headers["Content-Length"] = String(object.ContentLength);
    if (object.ContentRange) headers["Content-Range"] = object.ContentRange;
    if (params.get("download") === "1") {
      // <user>_<project>_audio<mode>_<recId>_<timestamp>.<ext> → rekaman-<mode>-<timestamp>.<ext>
      const name = key.split("/").pop() ?? "rekaman.mp3";
      const match = name.match(/_audio(menulis|perintah)_[a-zA-Z0-9-]+_(\d{8}-\d{6})\.(\w+)$/);
      headers["Content-Disposition"] = `attachment; filename="${match ? `rekaman-${match[1]}-${match[2]}.${match[3]}` : name}"`;
    }
    return new Response(object.Body.transformToWebStream(), { status: object.ContentRange ? 206 : 200, headers });
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 416) return new Response(null, { status: 416 });
    if (status !== 404) console.error("[voice/recording/audio] S3 read failed:", err);
    return NextResponse.json({ error: "Rekaman tidak ditemukan." }, { status: 404 });
  }
}

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { fileSafe, recordingsForZip, stamp } from "@/lib/admin/data";
import { zipStream, type ZipEntry } from "@/lib/admin/zip";
import { s3, s3Bucket, s3Configured } from "@/lib/storage/s3";

/**
 * GET /api/admin/zip?userId=<id>|all&format=mp3|wav|both
 * Every recording (of one student or of everyone) in one .zip, so the
 * admin doesn't download them one by one:
 *   <Nama>/<Proyek>/<menulis|perintah>/<timestamp>.mp3 (+ .txt transcript)
 */
export async function GET(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Login peneliti dulu." }, { status: 401 });
  if (!s3Configured()) return NextResponse.json({ error: "Penyimpanan S3 belum diatur." }, { status: 500 });

  const params = new URL(request.url).searchParams;
  const userId = params.get("userId") ?? "all";
  const format = (params.get("format") ?? "mp3") as "mp3" | "wav" | "both";
  if (!["mp3", "wav", "both"].includes(format)) return NextResponse.json({ error: "format: mp3 | wav | both" }, { status: 400 });

  const rows = await recordingsForZip(userId === "all" ? null : userId);
  if (!rows.length) return NextResponse.json({ error: "Belum ada rekaman." }, { status: 404 });

  const readKey = async (key: string) => {
    const object = await s3().send(new GetObjectCommand({ Bucket: s3Bucket(), Key: key }));
    return object.Body ? new Uint8Array(await object.Body.transformToByteArray()) : null;
  };
  const encoder = new TextEncoder();

  const entries: ZipEntry[] = [];
  for (const row of rows) {
    const folder = [
      fileSafe(row.user.name || row.user.email, "mahasiswa"),
      fileSafe(row.projectTitle, row.projectId ? `proyek-${row.projectId.slice(0, 8)}` : "tanpa-proyek"),
      row.mode,
    ].join("/");
    const base = `${folder}/${stamp(row.startedAt)}_${row.id.slice(0, 8)}`;
    const date = row.startedAt ?? undefined;
    if (format !== "wav" || !row.wavKey) entries.push({ name: `${base}.${row.audioKey.split(".").pop()}`, load: () => readKey(row.audioKey), date });
    if (format !== "mp3" && row.wavKey && row.wavKey !== row.audioKey) entries.push({ name: `${base}.wav`, load: () => readKey(row.wavKey!), date });

    const lines = (Array.isArray(row.transcript) ? row.transcript : []) as { at?: string; role?: string; text?: string }[];
    const text = [
      `Mahasiswa : ${row.user.name ?? "-"} <${row.user.email}>`,
      `Proyek    : ${row.projectTitle ?? row.projectId ?? "-"}`,
      `Mode      : ${row.mode}`,
      `Mulai     : ${row.startedAt?.toISOString() ?? "-"}`,
      "",
      "== Transkrip langsung ==",
      ...lines.map((l) => `[${l.role ?? "?"}] ${l.text ?? ""}`),
      ...(row.aiTranscript ? ["", "== Transkrip AI ==", row.aiTranscript] : []),
      "",
    ].join("\r\n");
    entries.push({ name: `${base}.txt`, load: async () => encoder.encode(text), date });
  }

  const who = userId === "all" ? "semua-mahasiswa" : fileSafe(rows[0].user.name || rows[0].user.email, "mahasiswa").replace(/ /g, "-");
  const name = `rekaman_${who}_${format}_${stamp(new Date())}.zip`;
  return new Response(zipStream(entries), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}

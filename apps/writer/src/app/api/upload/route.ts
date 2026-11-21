import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getServerSession } from "@sre-monorepo/lib/server";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, imageKey, imageUrl } from "@/lib/storage/uploads";
import { s3, s3Bucket, s3Configured, s3Prefix } from "@/lib/storage/s3";

/**
 * POST /api/upload (multipart: file, projectId?) — stores one image for the
 * draft editor (paste, drag & drop, or the "Gambar" button) and returns
 * { url } to put in the document.
 */
export async function POST(request: Request) {
  const session = await getServerSession();
  const user = session?.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!s3Configured()) return NextResponse.json({ error: "Penyimpanan S3 belum diatur." }, { status: 500 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Kirim sebagai multipart/form-data dengan field 'file'." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Field 'file' kosong." }, { status: 400 });

  const ext = IMAGE_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Format tidak didukung. Pakai PNG, JPG, GIF, atau WEBP." }, { status: 415 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: `Gambar terlalu besar (maks ${MAX_IMAGE_BYTES / 1024 / 1024} MB).` }, { status: 413 });
  }

  const projectId = String(form.get("projectId") ?? "") || null;
  const id = randomUUID();
  try {
    await s3().send(
      new PutObjectCommand({
        Bucket: s3Bucket(),
        Key: imageKey(s3Prefix(), String(user.id), projectId, id, ext),
        Body: Buffer.from(await file.arrayBuffer()),
        ContentType: file.type,
      })
    );
  } catch (err) {
    console.error("[upload] S3 put failed:", err);
    return NextResponse.json({ error: "Gagal menyimpan gambar ke penyimpanan." }, { status: 502 });
  }

  return NextResponse.json({ url: imageUrl(String(user.id), projectId, id, ext), sizeBytes: file.size, type: file.type });
}

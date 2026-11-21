import { randomUUID } from "crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getServerSession } from "@sre-monorepo/lib/server";
import { findRecording, listRecordings } from "@/lib/storage/listRecordings";
import { describeCall } from "@/lib/voice/commandCatalog";
import { deleteRecordingFromDb, saveRecordingToDb, saveRunToDb } from "@/lib/voice/voiceDb";
import {
  buildRecordingKeys,
  isOwnRecordingKey,
  isUuid,
  type CommandRun,
  type RecordingMeta,
  type RecordingMode,
} from "@/lib/storage/recordingKeys";
import { s3, s3Bucket, s3Configured, s3Prefix } from "@/lib/storage/s3";
import { wavToMp3 } from "@/lib/voice/mp3";

/**
 * Voice-session recordings in S3 (see recordingKeys.ts for the folder layout):
 *
 * POST  multipart { audio: WAV 16 kHz blob, meta: JSON } → stores the WAV,
 *       an MP3 made from it here (the copy that plays and goes to AI), and a
 *       .json (mode, times, transcript) next to them. Other formats (the
 *       browser fallback recorder) are stored as they are.
 * GET   ?mode=menulis|perintah&projectId=<id> → the signed-in user's
 *       recordings of that project and mode, newest first.
 * PATCH ?uuid=<recording UUID> { run } → logs one run of a Mode Perintah
 *       command in the recording's .json: tool calls + results, plus the
 *       intent and editor function of each call (commandCatalog.ts); GET
 *       then shows intent, actions (tool, function) and where each went.
 * DELETE ?uuid=<recording UUID> → removes one of the user's recordings (audio + .json).
 *       PATCH / DELETE still accept the older ?key=<S3 audio key>.
 *
 * The browser never talks to the bucket: uploads pass through here and
 * playback goes through ./audio, so the bucket stays private.
 */
const MAX_BYTES = 30 * 1024 * 1024; // a 10-minute session is ~19 MB of WAV 16 kHz (its MP3 ~3.6 MB)

const EXTENSIONS: Record<string, string> = { "audio/mpeg": "mp3", "audio/wav": "wav", "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a" };

const notConfigured = () =>
  NextResponse.json({ error: "Penyimpanan S3 belum diatur di server writer (S3_BUCKET, S3_ACCESS_KEY_ID, …)." }, { status: 500 });

export async function POST(request: Request) {
  const session = await getServerSession();
  const user = session?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!s3Configured()) return notConfigured();

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "Rekaman kosong." }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json({ error: "Rekaman terlalu besar (maks. 30 MB)." }, { status: 413 });
  }

  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(String(form?.get("meta") ?? "{}"));
  } catch {
    // Keep the audio even if the metadata is broken.
  }
  const mode: RecordingMode = meta.mode === "write" ? "menulis" : "perintah";
  const projectId = typeof meta.projectId === "string" ? meta.projectId : null;
  const uploadedType = (audio.type || "audio/mpeg").split(";")[0].replace(/^audio\/(x-wav|wave)$/, "audio/wav");
  const uploaded = new Uint8Array(await audio.arrayBuffer());
  const now = new Date();
  // The recording's UUID (returned, and the id in GET); the file name keeps its first 8 chars.
  const id = isUuid(meta.id) ? meta.id.toLowerCase() : randomUUID();
  const recId = id.slice(0, 8);
  const keys = (extension: string) =>
    buildRecordingKeys({ prefix: s3Prefix(), userId: String(user.id), projectId, mode, recId, date: now, extension });
  const { metaKey } = keys("mp3");

  // WAV: keep it, and make the MP3 that plays and goes to AI. If encoding
  // fails, the WAV becomes the main audio so nothing is lost.
  const objects: { key: string; body: Uint8Array; type: string }[] = [];
  let main: { key: string; body: Uint8Array; type: string };
  let wav: { key: string; body: Uint8Array } | null = null;
  let mp3Failed = false;
  if (uploadedType === "audio/wav") {
    wav = { key: keys("wav").audioKey, body: uploaded };
    objects.push({ ...wav, type: "audio/wav" });
    try {
      main = { key: keys("mp3").audioKey, body: wavToMp3(uploaded), type: "audio/mpeg" };
      objects.push(main);
    } catch (err) {
      console.error("[voice/recording] WAV → MP3 failed, keeping the WAV only:", err);
      mp3Failed = true;
      main = { key: wav.key, body: uploaded, type: "audio/wav" };
    }
  } else {
    main = { key: keys(EXTENSIONS[uploadedType] ?? "mp3").audioKey, body: uploaded, type: uploadedType };
    objects.push(main);
  }
  const mimeType = main.type;
  const audioKey = main.key;

  const record: RecordingMeta = {
    id,
    userId: String(user.id),
    userName: user.name ?? null,
    projectId: projectId ?? "tanpa-project",
    mode,
    recId,
    startedAt: typeof meta.startedAt === "string" ? meta.startedAt : null,
    endedAt: typeof meta.endedAt === "string" ? meta.endedAt : now.toISOString(),
    sizeBytes: main.body.byteLength,
    mimeType,
    audioKey,
    ...(wav && { wavKey: wav.key, wavSizeBytes: wav.body.byteLength }),
    transcript: Array.isArray(meta.transcript) ? meta.transcript : [],
  };

  try {
    // Audio first: a .json without its audio would show a broken entry.
    for (const object of objects) {
      await s3().send(
        new PutObjectCommand({ Bucket: s3Bucket(), Key: object.key, Body: Buffer.from(object.body), ContentType: object.type })
      );
    }
    await s3().send(
      new PutObjectCommand({
        Bucket: s3Bucket(),
        Key: metaKey,
        Body: JSON.stringify(record, null, 2),
        ContentType: "application/json",
      })
    );
  } catch (err) {
    console.error("[voice/recording] S3 upload failed:", err);
    return NextResponse.json({ error: "Rekaman gagal diunggah ke penyimpanan S3." }, { status: 502 });
  }

  // Postgres mirror (best effort: S3 stays the source).
  await saveRecordingToDb(id, record);

  return NextResponse.json({ uuid: id, path: audioKey, wavPath: wav?.key ?? null, mp3Failed });
}

export async function GET(request: Request) {
  const session = await getServerSession();
  const user = session?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!s3Configured()) return notConfigured();

  const params = new URL(request.url).searchParams;
  const mode: RecordingMode = params.get("mode") === "menulis" ? "menulis" : "perintah";

  try {
    const items = await listRecordings(String(user.id), params.get("projectId"), mode);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[voice/recording] S3 list failed:", err);
    return NextResponse.json({ error: "Gagal membaca rekaman dari penyimpanan S3." }, { status: 502 });
  }
}

const MAX_RUNS = 50;
const cut = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");

export async function PATCH(request: Request) {
  const session = await getServerSession();
  const user = session?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!s3Configured()) return notConfigured();

  const params = new URL(request.url).searchParams;
  const ref = params.get("uuid") ?? params.get("key") ?? "";
  const found = await findRecording(String(user.id), ref).catch(() => null);
  if (!found) {
    return NextResponse.json({ error: "Rekaman tidak ditemukan." }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  const raw = body?.run ?? {};
  const calls: CommandRun["calls"] = (Array.isArray(raw.calls) ? raw.calls : []).slice(0, 10).map((call: Record<string, unknown>) => {
    const tool = cut(call?.tool, 64);
    const args = call?.args && typeof call.args === "object" && !Array.isArray(call.args) ? (call.args as Record<string, unknown>) : {};
    // Intent + editor function stored with the run (commandCatalog.ts, mirrors the Excel).
    const described = describeCall(tool, args);
    return { tool, args, ok: call?.ok === true, message: cut(call?.message, 500), intent: described.intent, function: described.function };
  });
  const run: CommandRun = {
    at: new Date().toISOString(),
    source: raw.source === "riwayat" ? "riwayat" : "langsung",
    text: cut(raw.text, 2000),
    intent: calls[0]?.intent ?? null,
    calls,
    reply: raw.reply ? cut(raw.reply, 500) : null,
  };

  const { metaKey } = found;
  let saved: RecordingMeta;
  try {
    // Re-read right before writing, so a run logged in between isn't lost.
    const res = await s3().send(new GetObjectCommand({ Bucket: s3Bucket(), Key: metaKey }));
    const meta = JSON.parse((await res.Body?.transformToString()) ?? "") as RecordingMeta;
    meta.commandRuns = [...(meta.commandRuns ?? []), run].slice(-MAX_RUNS);
    saved = meta;
    await s3().send(
      new PutObjectCommand({ Bucket: s3Bucket(), Key: metaKey, Body: JSON.stringify(meta, null, 2), ContentType: "application/json" })
    );
  } catch (err) {
    console.error("[voice/recording] command log failed:", err);
    return NextResponse.json({ error: "Hasil perintah gagal dicatat di rekaman." }, { status: 502 });
  }
  // Postgres: VoiceCommandRun + VoiceCommandCall rows (best effort).
  await saveRunToDb(found.uuid, saved, run);
  return NextResponse.json({ ok: true, intent: run.intent, calls: calls.map(({ tool, intent, function: fn }) => ({ tool, intent, function: fn })) });
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  const user = session?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!s3Configured()) return notConfigured();

  const params = new URL(request.url).searchParams;
  const ref = params.get("uuid") ?? params.get("key") ?? "";
  const found = await findRecording(String(user.id), ref).catch(() => null);
  if (!found) {
    return NextResponse.json({ error: "Rekaman tidak ditemukan." }, { status: 404 });
  }
  const { meta, metaKey } = found;
  const key = meta.audioKey;
  try {
    // One request per object: DeleteObjects needs a checksum some S3-compatible providers reject.
    // The WAV original shares the name; deleting a missing key is harmless.
    const wavKey = meta.wavKey ?? key.replace(/\.[a-z0-9]+$/, ".wav");
    const objects = [key, wavKey, metaKey].filter(object => object === metaKey || isOwnRecordingKey(object, s3Prefix(), String(user.id)));
    for (const object of new Set(objects)) {
      await s3().send(new DeleteObjectCommand({ Bucket: s3Bucket(), Key: object }));
    }
  } catch (err) {
    console.error("[voice/recording] S3 delete failed:", err);
    return NextResponse.json({ error: "Rekaman gagal dihapus dari penyimpanan S3." }, { status: 502 });
  }
  await deleteRecordingFromDb(found.uuid);
  return NextResponse.json({ ok: true });
}

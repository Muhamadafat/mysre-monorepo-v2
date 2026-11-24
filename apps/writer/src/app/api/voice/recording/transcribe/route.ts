import { createHash } from "crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getServerSession, prisma } from "@sre-monorepo/lib/server";
import { findRecording } from "@/lib/storage/listRecordings";
import { saveAiTranscriptToDb } from "@/lib/voice/voiceDb";
import { isOwnRecordingKey, type RecordingMeta } from "@/lib/storage/recordingKeys";
import { s3, s3Bucket, s3Configured, s3Prefix } from "@/lib/storage/s3";
import {
  BATCH_LIMITS,
  MAX_TRANSCRIBE_BYTES,
  TRANSCRIBE_LIMITS,
  TranscribeError,
  isPromptEcho,
  estimateTranscribeUsd,
  speechToText,
  sttNeedsOpenAiKey,
  sttProvider,
  transcribeModel,
} from "@/lib/voice/transcribe";

/**
 * "Transkrip AI" for one saved recording, on request (a button in the
 * history, never automatic): POST { uuid: <recording UUID> } (older { key: <UUID or S3 audio key> } still works).
 *
 * Reads the recording's MP3 from S3 (never the WAV original, even when its
 * key is the one passed), sends it to OpenAI (gpt-4o-transcribe, Indonesian),
 * stores the text in the recording's .json next to the audio, and logs the
 * cost as a TokenUsage row (purpose "transcribe"). A recording that already
 * has an AI transcript returns it without calling OpenAI again.
 *
 * { uuid, purpose: "batch" } is the "Rekam dulu" voice mode: called right after
 * the recording is saved, so the text can be typed (Mode Menulis) or run as
 * commands (Mode Perintah). It has its own allowance (BATCH_LIMITS, TokenUsage
 * purpose "voice-batch"), uses the speech-to-text service in STT_PROVIDER, and
 * also fills the recording's transcript so the history and the research page
 * show what was said.
 */
export const maxDuration = 120; // a 10-minute recording can take a while

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const STT_PROMPT = "Percakapan bahasa Indonesia tentang penulisan karya ilmiah: draf, paragraf, outline, referensi, artikel.";

export async function POST(request: Request) {
  const session = await getServerSession();
  const user = session?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!s3Configured()) {
    return NextResponse.json({ error: "Penyimpanan S3 belum diatur di server writer." }, { status: 500 });
  }
  const body = await request.json().catch(() => ({}));
  const batch = body?.purpose === "batch";
  // Same key as the voice assistant: the lecturer's key, the user's own only as a fallback.
  // Another speech-to-text vendor (STT_PROVIDER) brings its own key.
  const apiKey = process.env.VOICE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "";
  if (!apiKey && (!batch || sttNeedsOpenAiKey())) {
    return NextResponse.json({ error: "VOICE_OPENAI_API_KEY belum diatur di server writer." }, { status: 500 });
  }
  const usagePurpose = batch ? "voice-batch" : "transcribe";
  const limits = batch ? BATCH_LIMITS : TRANSCRIBE_LIMITS;
  // The recording's UUID (or the older S3 audio key).
  const ref = typeof body?.uuid === "string" ? body.uuid : body?.key;
  const found = typeof ref === "string" ? await findRecording(String(user.id), ref).catch(() => null) : null;
  if (!found) {
    return NextResponse.json({ error: "Rekaman tidak ditemukan." }, { status: 404 });
  }
  const { metaKey } = found;
  const key = found.meta.audioKey;
  const meta: RecordingMeta = found.meta;
  // Already done: free.
  if (meta.aiTranscript?.text !== undefined) {
    return NextResponse.json({ aiTranscript: meta.aiTranscript, cached: true });
  }

  // Limits: per user per day, and the monthly budget for everyone.
  const monthStart = startOfToday();
  monthStart.setDate(1);
  const [todayCount, monthRows] = await Promise.all([
    prisma.tokenUsage.count({ where: { userId: user.id, purpose: usagePurpose, createdAt: { gte: startOfToday() } } }),
    prisma.tokenUsage.findMany({ where: { purpose: usagePurpose, createdAt: { gte: monthStart } }, select: { metadata: true } }),
  ]);
  if (todayCount >= limits.dailyPerUser) {
    return NextResponse.json(
      {
        error: batch
          ? `Jatah rekaman suara hari ini (${limits.dailyPerUser} rekaman) sudah habis. Coba lagi besok.`
          : `Jatah transkrip AI hari ini (${limits.dailyPerUser} rekaman) sudah habis. Coba lagi besok.`,
      },
      { status: 429 }
    );
  }
  const spentThisMonth = monthRows.reduce(
    (sum, row) => sum + (Number((row.metadata as { estimatedUsd?: number } | null)?.estimatedUsd) || 0),
    0
  );
  if (spentThisMonth >= limits.monthlyBudgetUsd) {
    return NextResponse.json(
      { error: batch ? "Batas biaya asisten suara bulan ini sudah tercapai. Hubungi admin." : "Batas biaya transkrip AI bulan ini sudah tercapai. Hubungi admin." },
      { status: 429 }
    );
  }

  // The MP3 is the main audio (meta.audioKey); the WAV only when no MP3 could be made.
  const audioKey = meta.audioKey && isOwnRecordingKey(meta.audioKey, s3Prefix(), String(user.id)) ? meta.audioKey : key;
  let audio: Uint8Array;
  let mimeType = meta.mimeType || "audio/mpeg";
  try {
    const res = await s3().send(new GetObjectCommand({ Bucket: s3Bucket(), Key: audioKey }));
    if ((res.ContentLength ?? 0) > MAX_TRANSCRIBE_BYTES) {
      return NextResponse.json({ error: "Rekaman terlalu besar untuk ditranskrip (maks. 25 MB)." }, { status: 413 });
    }
    audio = (await res.Body?.transformToByteArray()) ?? new Uint8Array(0);
    mimeType = res.ContentType || mimeType;
  } catch (err) {
    console.error("[voice/transcribe] S3 read failed:", err);
    return NextResponse.json({ error: "File rekaman tidak bisa dibaca dari S3." }, { status: 502 });
  }

  const model = sttProvider() === "openai" ? transcribeModel() : sttProvider();
  let result;
  const startedAt = Date.now();
  try {
    result = await speechToText({
      audio,
      mimeType,
      apiKey,
      model,
      language: "id",
      prompt: STT_PROMPT,
      safetyIdentifier: createHash("sha256").update(String(user.id)).digest("hex"),
    });
  } catch (err) {
    if (err instanceof TranscribeError) {
      console.error("[voice/transcribe] OpenAI failed:", err.message);
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[voice/transcribe] unexpected:", err);
    return NextResponse.json({ error: "Transkripsi gagal." }, { status: 500 });
  }

  // OpenAI has charged at this point: log it before anything else can fail.
  const seconds =
    meta.startedAt && meta.endedAt
      ? Math.max(1, Math.round((Date.parse(meta.endedAt) - Date.parse(meta.startedAt)) / 1000))
      : Math.max(1, Math.round(audio.byteLength / 6000)); // 48 kbps MP3 ≈ 6 KB per second
  await prisma.tokenUsage
    .create({
      data: {
        userId: user.id,
        model,
        purpose: usagePurpose,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        tokensUsed: result.inputTokens + result.outputTokens,
        metadata: {
          seconds,
          estimatedUsd: estimateTranscribeUsd(seconds),
          recordingKey: audioKey,
          latencyMs: Date.now() - startedAt,
        },
      },
    })
    .catch(err => console.error("[voice/transcribe] usage log failed:", err));

  // No speech → OpenAI may answer with the hint prompt's own words; that is
  // not something the user said (and must never run as a command).
  if (isPromptEcho(result.text, STT_PROMPT)) result = { ...result, text: "" };
  const aiTranscript = { text: result.text, model: result.model || model, createdAt: new Date().toISOString() };
  const updated: RecordingMeta = { ...meta, aiTranscript };
  // "Rekam dulu" recordings arrive without a live transcript: this text is it,
  // in the same shape the realtime modes use ("Menulis: …" lines are what got typed).
  if (batch && !(meta.transcript ?? []).length && result.text) {
    const at = meta.endedAt ?? aiTranscript.createdAt;
    updated.transcript =
      meta.mode === "menulis" ? [{ at, role: "tool", text: `Menulis: ${result.text}` }] : [{ at, role: "user", text: result.text }];
  }
  try {
    await s3().send(
      new PutObjectCommand({
        Bucket: s3Bucket(),
        Key: metaKey,
        Body: JSON.stringify(updated, null, 2),
        ContentType: "application/json",
      })
    );
  } catch (err) {
    // The text still goes back to the user; it just isn't remembered.
    console.error("[voice/transcribe] saving to S3 failed:", err);
    return NextResponse.json({ aiTranscript, saved: false });
  }

  await saveAiTranscriptToDb(found.uuid, updated);
  return NextResponse.json({ aiTranscript, saved: true });
}

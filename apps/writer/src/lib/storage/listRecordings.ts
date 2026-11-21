import { createHash } from "crypto";
import { GetObjectCommand, ListObjectsV2Command, type _Object } from "@aws-sdk/client-s3";
import { FOLDERS, isOwnRecordingKey, isUuid, recordingFolder, userPrefix, type RecordingMeta, type RecordingMode } from "@/lib/storage/recordingKeys";
import { s3, s3Bucket, s3Prefix } from "@/lib/storage/s3";
import { describeCall } from "@/lib/voice/commandCatalog";

/**
 * The recording's UUID: the stored one, or for older recordings (before
 * 2026-11-17) a stable UUID (v5-style, SHA-1 of the audio key) so their id
 * never changes between requests.
 */
export function recordingUuid(meta: Pick<RecordingMeta, "id" | "audioKey">): string {
  if (isUuid(meta.id)) return meta.id.toLowerCase();
  const hex = createHash("sha1").update(`sre-writer-recording:${meta.audioKey}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const h = hex.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Mode Perintah: what the command was understood as and what it did, from
 * the stored runs (the latest run's calls, in order). Intent,
 * action and target come from the catalog (docs/daftar-perintah-suara.xlsx).
 */
function commandSummary(meta: RecordingMeta) {
  const runs = meta.commandRuns ?? [];
  const last = runs[runs.length - 1];
  const actions = (last?.calls ?? []).map(call => {
    const described = describeCall(call.tool, call.args);
    return {
      ...described,
      // A tool the catalog no longer knows keeps what was stored when it ran.
      intent: described.intent ?? call.intent ?? null,
      function: described.function ?? call.function ?? null,
      result: { ok: call.ok, message: call.message },
    };
  });
  const status = !last
    ? "belum_dijalankan"
    : !last.calls.length
      ? "tidak_dikenali"
      : last.calls.every(call => call.ok)
        ? "berhasil"
        : "gagal";
  return {
    intent: actions[0]?.intent ?? null,
    status,
    actions,
    lastRun: last ? { at: last.at, source: last.source, text: last.text, reply: last.reply } : null,
    runCount: runs.length,
  };
}

const MAX_LIST = 100;

/** Every key under `prefix` (pages of up to 1000), stopping at `max`. */
async function listKeys(prefix: string, max = 5000): Promise<_Object[]> {
  const objects: _Object[] = [];
  let token: string | undefined;
  do {
    const page = await s3().send(new ListObjectsV2Command({ Bucket: s3Bucket(), Prefix: prefix, ContinuationToken: token }));
    objects.push(...(page.Contents ?? []));
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token && objects.length < max);
  return objects;
}

async function readMeta(metaKey: string): Promise<RecordingMeta | null> {
  try {
    const res = await s3().send(new GetObjectCommand({ Bucket: s3Bucket(), Key: metaKey }));
    const meta = JSON.parse((await res.Body?.transformToString()) ?? "") as RecordingMeta;
    return meta?.audioKey ? meta : null;
  } catch {
    return null;
  }
}

export interface FoundRecording {
  meta: RecordingMeta;
  metaKey: string;
  uuid: string;
}

/**
 * One of the user's recordings by its UUID (the `uuid` in the API).
 * An S3 audio key is still accepted, so older clients keep working.
 * Null when it doesn't exist or isn't this user's.
 *
 * New recordings carry the UUID's first 8 characters in their file name, so
 * those are read first; older ones (derived UUID) need the rest scanned.
 */
export async function findRecording(userId: string, ref: string): Promise<FoundRecording | null> {
  const prefix = s3Prefix();
  const own = (meta: RecordingMeta) => isOwnRecordingKey(meta.audioKey, prefix, userId);

  if (!isUuid(ref)) {
    if (!isOwnRecordingKey(ref, prefix, userId)) return null;
    const metaKey = (ref as string).replace(/\.[a-z0-9]+$/, ".json");
    const meta = await readMeta(metaKey);
    return meta && own(meta) ? { meta, metaKey, uuid: recordingUuid(meta) } : null;
  }

  const uuid = ref.toLowerCase();
  const audioFolders = new RegExp(`/(${FOLDERS.menulis}|${FOLDERS.perintah})/[^/]+\\.json$`);
  const metaKeys = (await listKeys(userPrefix(prefix, userId)))
    .map(object => object.Key ?? "")
    .filter(key => audioFolders.test(key));
  const short = `_${uuid.slice(0, 8)}_`;
  const ordered = [...metaKeys.filter(key => key.includes(short)), ...metaKeys.filter(key => !key.includes(short))];

  for (let i = 0; i < ordered.length; i += 20) {
    const batch = ordered.slice(i, i + 20);
    const metas = await Promise.all(batch.map(readMeta));
    const index = metas.findIndex(meta => meta && own(meta) && recordingUuid(meta) === uuid);
    if (index >= 0) return { meta: metas[index]!, metaKey: batch[index], uuid };
  }
  return null;
}

/**
 * Every recording .json in the bucket (all users, both modes), for the
 * Postgres sync (npm run voice:db-sync). Broken ones are skipped.
 */
export async function listAllRecordingMetas(): Promise<{ meta: RecordingMeta; metaKey: string; uuid: string }[]> {
  const audioFolders = new RegExp(`/(${FOLDERS.menulis}|${FOLDERS.perintah})/[^/]+\.json$`);
  const keys = (await listKeys(s3Prefix(), 100000)).map(object => object.Key ?? "").filter(key => audioFolders.test(key));
  const found: { meta: RecordingMeta; metaKey: string; uuid: string }[] = [];
  for (let i = 0; i < keys.length; i += 20) {
    const batch = keys.slice(i, i + 20);
    const metas = await Promise.all(batch.map(readMeta));
    metas.forEach((meta, j) => {
      if (meta) found.push({ meta, metaKey: batch[j], uuid: recordingUuid(meta) });
    });
  }
  return found;
}

/** Audio URL of a recording for the browser: by UUID, never the S3 path. */
const audioUrl = (uuid: string, file?: "wav", download?: boolean) =>
  `/api/voice/recording/audio?uuid=${uuid}${file ? `&file=${file}` : ""}${download ? "&download=1" : ""}`;

/**
 * One user's recordings of one project and mode, newest first (max 100).
 * Shared by GET /api/voice/recording and GET /api/projects/audio/[id]/[mode].
 * Throws when S3 can't be listed.
 */
export async function listRecordings(userId: string, projectId: string | null, mode: RecordingMode) {
  const folder = recordingFolder(s3Prefix(), userId, projectId, mode);

  // Every .json in the folder.
  const metaObjects = (await listKeys(folder, 15000)).filter(object => object.Key?.endsWith(".json"));

  // Newest first by the timestamp in the name (…_20261117-120343.json): the
  // .json is rewritten when a command run is logged, so LastModified moves.
  const stamp = (object: _Object) => object.Key?.match(/_(\d{8}-\d{6})\.json$/)?.[1] ?? "";
  const newest = metaObjects
    .sort((a, b) => stamp(b).localeCompare(stamp(a)) || (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0))
    .slice(0, MAX_LIST);

  // One broken .json (null) shouldn't hide the rest.
  const metas = await Promise.all(newest.map(object => readMeta(object.Key ?? "")));

  return metas
    .filter((meta): meta is RecordingMeta => Boolean(meta?.audioKey))
    .map(meta => {
      // Mode Perintah only: intent first, the rest of the summary after the audio fields.
      const { intent, ...command } = meta.mode === "perintah" ? commandSummary(meta) : { intent: undefined };
      const uuid = recordingUuid(meta);
      const hasWav = Boolean(meta.wavKey && meta.wavKey !== meta.audioKey);
      return {
        ...(meta.mode === "perintah" ? { intent } : {}),
        /** The recording's UUID: what the audio / delete / command / transcribe routes take (?uuid=). */
        uuid,
        mode: meta.mode,
        startedAt: meta.startedAt,
        endedAt: meta.endedAt,
        sizeBytes: meta.sizeBytes,
        mimeType: meta.mimeType,
        transcript: meta.transcript ?? [],
        aiTranscript: meta.aiTranscript ?? null,
        url: audioUrl(uuid),
        /** Same file, saved as an attachment (rekaman-<mode>-<timestamp>.mp3). */
        downloadUrl: audioUrl(uuid, undefined, true),
        // The WAV original, when it is a separate file from the main audio.
        wavUrl: hasWav ? audioUrl(uuid, "wav") : null,
        wavDownloadUrl: hasWav ? audioUrl(uuid, "wav", true) : null,
        wavSizeBytes: hasWav ? (meta.wavSizeBytes ?? null) : null,
        ...command,
      };
    });
}

export type RecordingListItem = Awaited<ReturnType<typeof listRecordings>>[number];

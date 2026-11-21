/**
 * Folder layout in the S3 bucket (S3 has no real folders: these are key
 * prefixes, and the storage browser shows them as folders automatically).
 *
 *   <S3_PREFIX><userId>/<projectId>/AUDIO_MENULIS/<userId>_<projectId>_audiomenulis_<recId>_<timestamp>.mp3
 *                                  /AUDIO_MENULIS/<same name>.wav    ← original, WAV 16 kHz mono
 *                                  /AUDIO_MENULIS/<same name>.json   ← mode, times, transcript
 *                                  /AUDIO_PERINTAH/…
 *                                  /PDF_UPLOAD/…                     ← reserved for PDF uploads
 *
 * S3_PREFIX (e.g. "dev/") keeps development and production data apart in one bucket.
 */

export type RecordingMode = "menulis" | "perintah";

export const FOLDERS = {
  menulis: "AUDIO_MENULIS",
  perintah: "AUDIO_PERINTAH",
  pdf: "PDF_UPLOAD",
} as const;

/** One run of the spoken command: what the AI made of it and how each call went. */
export interface CommandRun {
  at: string;
  /** "langsung" = right after recording stopped; "riwayat" = "Jalankan" in the history. */
  source: "langsung" | "riwayat";
  /** The spoken text that was interpreted. */
  text: string;
  /** Tool calls in order, with their result; empty when nothing was recognised. */
  calls: {
    tool: string;
    args: Record<string, unknown>;
    ok: boolean;
    message: string;
    /** Intent and editor function from commandCatalog.ts when the run was logged (since 2026-11-17). */
    intent?: string | null;
    function?: string | null;
  }[];
  /** Intent of the first call when logged (null = nothing recognised). */
  intent?: string | null;
  /** The interpreter's reply when it found no command. */
  reply: string | null;
}

/** The .json saved next to each recording. */
export interface RecordingMeta {
  /** UUID of the recording (recordings before 2026-11-17 have none: see recordingUuid). */
  id?: string;
  userId: string;
  userName: string | null;
  projectId: string;
  mode: RecordingMode;
  recId: string;
  startedAt: string | null;
  endedAt: string | null;
  /** Size and type of the audio at `audioKey` (the MP3 for WAV recordings). */
  sizeBytes: number;
  mimeType: string;
  /**
   * Key of the main audio object (same folder, same name, audio extension):
   * the MP3 — played in the history and sent to AI transcription.
   */
  audioKey: string;
  /** The original WAV 16 kHz mono next to the MP3 (recordings since 2026-11-16). */
  wavKey?: string;
  wavSizeBytes?: number;
  transcript: { at: string; role: string; text: string }[];
  /** Full transcript of the audio file made by OpenAI on request ("Transkrip AI"). */
  aiTranscript?: { text: string; model: string; createdAt: string };
  /** Mode Perintah: every time the command was run (newest last). */
  commandRuns?: CommandRun[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

/** Only letters, digits, "-" and "_" in a key segment (ids come from the database / URL). */
export function safeSegment(value: string | null | undefined, fallback: string): string {
  const cleaned = String(value ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  return cleaned || fallback;
}

/** Normalised S3_PREFIX: "" or "something/". */
export function normalisePrefix(prefix: string | undefined): string {
  const trimmed = (prefix ?? "").trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `${trimmed}/` : "";
}

/** 2026-11-11 09:15:02 (server local time) → "20261111-091502". */
export function keyTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/** Everything one user owns starts with this. */
export function userPrefix(prefix: string, userId: string): string {
  return `${normalisePrefix(prefix)}${safeSegment(userId, "user")}/`;
}

/** The folder holding one project's recordings of one mode. */
export function recordingFolder(prefix: string, userId: string, projectId: string | null, mode: RecordingMode): string {
  return `${userPrefix(prefix, userId)}${safeSegment(projectId, "tanpa-project")}/${FOLDERS[mode]}/`;
}

/** Audio + metadata keys for a new recording. */
export function buildRecordingKeys(options: {
  prefix: string;
  userId: string;
  projectId: string | null;
  mode: RecordingMode;
  recId: string;
  date: Date;
  extension: string;
}): { audioKey: string; metaKey: string; baseName: string } {
  const user = safeSegment(options.userId, "user");
  const project = safeSegment(options.projectId, "tanpa-project");
  const baseName = `${user}_${project}_audio${options.mode}_${safeSegment(options.recId, "rec")}_${keyTimestamp(options.date)}`;
  const folder = recordingFolder(options.prefix, options.userId, options.projectId, options.mode);
  return { audioKey: `${folder}${baseName}.${options.extension}`, metaKey: `${folder}${baseName}.json`, baseName };
}

/**
 * True when `key` is one of this user's recordings: inside their own prefix,
 * in an audio folder, with no ".." or odd characters. Guards the audio route.
 */
export function isOwnRecordingKey(key: string, prefix: string, userId: string): boolean {
  const own = userPrefix(prefix, userId);
  if (!key.startsWith(own)) return false;
  const rest = key.slice(own.length);
  return new RegExp(`^[a-zA-Z0-9_-]+/(${FOLDERS.menulis}|${FOLDERS.perintah})/[a-zA-Z0-9_-]+\\.(mp3|wav|webm|ogg|m4a)$`).test(rest);
}

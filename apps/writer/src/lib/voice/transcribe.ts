/**
 * Transcribes a saved recording with OpenAI's speech-to-text API
 * (POST /v1/audio/transcriptions, default model gpt-4o-transcribe).
 * No database or S3 here, so it can be tested with a fake fetch.
 *
 *   OPENAI_TRANSCRIBE_MODEL         default "gpt-4o-transcribe" ("gpt-4o-mini-transcribe" is cheaper)
 *   TRANSCRIBE_DAILY_PER_USER       transcriptions per user per day (default 20)
 *   TRANSCRIBE_MONTHLY_BUDGET_USD   estimated spend for all users per month (default 5)
 *   TRANSCRIBE_USD_PER_MINUTE       price used for that estimate (default 0.006, check openai.com/api/pricing)
 */

const num = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const TRANSCRIBE_LIMITS = {
  dailyPerUser: num(process.env.TRANSCRIBE_DAILY_PER_USER, 20),
  monthlyBudgetUsd: num(process.env.TRANSCRIBE_MONTHLY_BUDGET_USD, 5),
  usdPerMinute: num(process.env.TRANSCRIBE_USD_PER_MINUTE, 0.006),
};

/** OpenAI's upload limit for transcription. */
export const MAX_TRANSCRIBE_BYTES = 25 * 1024 * 1024;

export const transcribeModel = () => process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe";

export function estimateTranscribeUsd(seconds: number): number {
  return (Math.max(seconds, 1) / 60) * TRANSCRIBE_LIMITS.usdPerMinute;
}

/** A failure with a message for the user (Indonesian) and the HTTP status to return. */
export class TranscribeError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "TranscribeError";
  }
}

const EXTENSIONS: Record<string, string> = { "audio/mpeg": "mp3", "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/wav": "wav" };

/** OpenAI's HTTP status → what to tell the user. */
export function transcribeErrorMessage(status: number, detail?: string): TranscribeError {
  const suffix = detail ? ` (${detail})` : "";
  switch (status) {
    case 401:
      return new TranscribeError("API key OpenAI tidak valid. Hubungi admin.", 502);
    case 403:
    case 404:
      return new TranscribeError(`Akun OpenAI tidak punya akses ke model transkripsi${suffix}.`, 502);
    case 413:
      return new TranscribeError("Rekaman terlalu besar untuk ditranskrip (maks. 25 MB).", 413);
    case 400:
      return new TranscribeError(`OpenAI menolak file rekaman ini${suffix}.`, 422);
    case 429:
      return new TranscribeError("Kuota/batas OpenAI sedang habis. Coba lagi nanti.", 429);
    default:
      return new TranscribeError(`Layanan transkripsi OpenAI bermasalah (HTTP ${status}). Coba lagi nanti.`, 502);
  }
}

export interface TranscribeResult {
  text: string;
  model: string;
  /** Token usage when OpenAI reports it (gpt-4o-transcribe does). */
  inputTokens: number;
  outputTokens: number;
}

export async function transcribeAudio(options: {
  audio: Uint8Array;
  mimeType: string;
  apiKey: string;
  model?: string;
  /** ISO-639-1; Indonesian improves accuracy and speed. */
  language?: string;
  /** Words/spelling hints (names, technical terms). */
  prompt?: string;
  /** Lets OpenAI tell users apart for abuse handling without knowing who they are. */
  safetyIdentifier?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<TranscribeResult> {
  const model = options.model ?? transcribeModel();
  if (options.audio.byteLength === 0) throw new TranscribeError("File rekaman kosong.", 422);
  if (options.audio.byteLength > MAX_TRANSCRIBE_BYTES) {
    throw new TranscribeError("Rekaman terlalu besar untuk ditranskrip (maks. 25 MB).", 413);
  }

  const baseType = options.mimeType.split(";")[0] || "audio/mpeg";
  const form = new FormData();
  form.append("file", new Blob([options.audio as BlobPart], { type: baseType }), `rekaman.${EXTENSIONS[baseType] ?? "mp3"}`);
  form.append("model", model);
  form.append("language", options.language ?? "id");
  form.append("response_format", "json");
  if (options.prompt) form.append("prompt", options.prompt);

  let res: Response;
  try {
    res = await (options.fetchImpl ?? fetch)("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        ...(options.safetyIdentifier ? { "OpenAI-Safety-Identifier": options.safetyIdentifier } : {}),
      },
      body: form,
      signal: AbortSignal.timeout(options.timeoutMs ?? 110_000),
    });
  } catch (err) {
    const timedOut = (err as Error)?.name === "TimeoutError";
    throw new TranscribeError(
      timedOut ? "Transkripsi terlalu lama (lebih dari 2 menit). Coba lagi." : "Tidak bisa menghubungi OpenAI.",
      504
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw transcribeErrorMessage(res.status, typeof data?.error?.message === "string" ? data.error.message.slice(0, 160) : undefined);
  }
  const text = typeof data?.text === "string" ? data.text.trim() : "";
  return {
    text,
    model,
    inputTokens: Number(data?.usage?.input_tokens) || 0,
    outputTokens: Number(data?.usage?.output_tokens) || 0,
  };
}

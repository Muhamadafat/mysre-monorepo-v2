import { createDownsampler, encodeWav, WAV_SAMPLE_RATE } from "./wav";

/**
 * Records one voice session's microphone for storage.
 *
 * First choice: WAV PCM 16-bit mono 16 kHz, captured from the session's own
 * mic stream with Web Audio and downsampled here (no worker, no extra mic
 * prompt). The server stores this WAV and makes an MP3 copy from it — the MP3
 * plays in the history and is what goes to AI transcription.
 * If Web Audio can't start, the browser's MediaRecorder records instead
 * (WebM/Opus in Chrome/Edge/Firefox, MP4 in Safari), so a recording is never
 * lost; that one is stored as-is, without a WAV.
 *
 * Only the user's voice is recorded: the AI's replies are a separate remote
 * track and are kept as text in the transcript JSON.
 */

export interface SessionRecorder {
  kind: "wav" | "native";
  /** Resolves with the finished audio. */
  stop(): Promise<Blob>;
  /** Silences the recording while the user has muted the mic. */
  setMuted(muted: boolean): void;
}

export interface StartedRecorder {
  recorder: SessionRecorder;
  /** Set when WAV capture failed and the fallback is used: why. */
  fallbackReason?: string;
}

async function startWav(stream: MediaStream): Promise<SessionRecorder> {
  const AudioCtx: typeof AudioContext | undefined =
    typeof window !== "undefined" ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext : undefined;
  if (!AudioCtx) throw new Error("browser tidak mendukung Web Audio");
  // Context at the device's own rate: Firefox can't connect a mic to a
  // context with a different rate, so the 16 kHz conversion happens here.
  const context = new AudioCtx();
  if (context.state === "suspended") await context.resume().catch(() => {});
  const source = context.createMediaStreamSource(stream);
  // ScriptProcessor: deprecated but everywhere, and needs no worklet file.
  const processor = context.createScriptProcessor(4096, 1, 1);
  const downsample = createDownsampler(context.sampleRate, WAV_SAMPLE_RATE);
  const chunks: Int16Array[] = [];
  let muted = false;
  processor.onaudioprocess = event => {
    const input = event.inputBuffer.getChannelData(0);
    chunks.push(muted ? new Int16Array(downsample(new Float32Array(input.length)).length) : downsample(input));
  };
  // Through a silent gain to the output: some browsers only run a processor that reaches the destination.
  const sink = context.createGain();
  sink.gain.value = 0;
  source.connect(processor);
  processor.connect(sink);
  sink.connect(context.destination);

  let stopped: Promise<Blob> | null = null;
  return {
    kind: "wav",
    stop: () =>
      (stopped ??= (async () => {
        processor.onaudioprocess = null;
        source.disconnect();
        processor.disconnect();
        sink.disconnect();
        await context.close().catch(() => {});
        return new Blob([encodeWav(chunks) as BlobPart], { type: "audio/wav" });
      })()),
    setMuted: value => {
      muted = value;
    },
  };
}

/** Best container the browser can record speech into. */
function nativeMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"];
  return candidates.find(type => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type));
}

function startNative(stream: MediaStream): SessionRecorder {
  if (typeof MediaRecorder === "undefined") throw new Error("browser tidak mendukung MediaRecorder");
  const mimeType = nativeMimeType();
  // 32 kbps Opus is clear for speech: ~0.24 MB per minute.
  const media = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32_000 });
  const chunks: Blob[] = [];
  media.ondataavailable = event => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  media.start(1000); // a chunk per second: little is lost if the tab dies
  return {
    kind: "native",
    stop: () =>
      new Promise<Blob>((resolve, reject) => {
        if (media.state === "inactive") return resolve(new Blob(chunks, { type: (mimeType ?? "audio/webm").split(";")[0] }));
        media.onstop = () => resolve(new Blob(chunks, { type: (media.mimeType || mimeType || "audio/webm").split(";")[0] }));
        media.onerror = () => reject(new Error("MediaRecorder gagal"));
        media.stop();
      }),
    // Muting disables the session's mic track itself, which MediaRecorder records as silence.
    setMuted: () => {},
  };
}

/**
 * Starts the WAV recorder on `sessionMic` (the mic stream the voice session
 * already uses), or falls back to MediaRecorder on the same stream.
 */
export async function startSessionRecorder(sessionMic: MediaStream): Promise<StartedRecorder> {
  try {
    return { recorder: await startWav(sessionMic) };
  } catch (err) {
    const fallbackReason = (err as Error)?.message || String(err);
    console.error("[rekaman] perekam WAV gagal, beralih ke perekam bawaan browser:", fallbackReason, err);
    return { recorder: startNative(sessionMic), fallbackReason };
  }
}

import { useCallback, useEffect, useRef, useState } from "react";
import { notifications } from "@mantine/notifications";
import type { VoiceCommandResult } from "@/components/PlateEditor";
import { startSessionRecorder, type SessionRecorder } from "@/lib/voice/sessionRecorder";
import type { SavedRecording, VoiceMode, VoiceStatus, VoiceTranscriptLine } from "./useRealtimeVoice";

/**
 * "Rekam dulu" voice: for a speech-to-text service that has no realtime API.
 * Nothing is sent while the user speaks. On stop, the whole recording is
 * saved first (POST /api/voice/recording → S3 + Postgres), then that saved
 * recording is turned into text (POST /api/voice/recording/transcribe with
 * purpose "batch", which reads it back from S3). The text is then typed at the
 * cursor (Mode Menulis) or handed to onSessionEnd to run as commands (Mode
 * Perintah), exactly like the realtime hook does.
 *
 * Returns the same fields as useRealtimeVoice, so the dock can use either,
 * plus `phase` for its steps.
 */
export type BatchPhase = "recording" | "uploading" | "transcribing" | "typing";

/** Longest recording; the server's limits (30 MB WAV, 25 MB MP3) allow ~10 minutes. */
const MAX_SECONDS = 600;

interface UseBatchVoiceOptions {
  onCommand: (name: string, args: Record<string, unknown>) => Promise<VoiceCommandResult>;
  onSessionEnd?: (mode: VoiceMode, userLines: string[], saved: Promise<SavedRecording | null>) => void;
}

export function useBatchVoice({ onCommand, onSessionEnd }: UseBatchVoiceOptions) {
  const [phase, setPhase] = useState<BatchPhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recording, setRecording] = useState<{ ok: boolean; message: string } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const micRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<SessionRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modeRef = useRef<VoiceMode>("write");
  const startedAtRef = useRef(0);
  const phaseRef = useRef<BatchPhase | null>(null);
  const onCommandRef = useRef(onCommand);
  const onSessionEndRef = useRef(onSessionEnd);
  useEffect(() => {
    onCommandRef.current = onCommand;
    onSessionEndRef.current = onSessionEnd;
  });

  const enterPhase = useCallback((next: BatchPhase | null) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  /** Mic, analyser and timer off; the recorder is stopped by the caller. */
  const release = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setSecondsLeft(null);
    micRef.current?.getTracks().forEach(track => track.stop());
    micRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    setMuted(false);
  }, []);

  const fail = useCallback(
    (message: string) => {
      setRecording({ ok: false, message });
      notifications.show({ title: "Suara tidak diproses", message, color: "red", autoClose: 12000 });
      enterPhase(null);
    },
    [enterPhase]
  );

  /** Stop: save the recording, transcribe the saved file, then type / run it. */
  const finish = useCallback(
    async (reason?: string) => {
      if (phaseRef.current !== "recording") return;
      const recorder = recorderRef.current;
      recorderRef.current = null;
      const mode = modeRef.current;
      const startedAt = startedAtRef.current;
      if (reason) setNotice(reason);
      enterPhase("uploading");

      let blob: Blob;
      try {
        blob = recorder ? await recorder.stop() : new Blob();
      } catch (err) {
        release();
        fail(`Perekam gagal: ${(err as Error)?.message || "error tidak diketahui"}.`);
        return;
      }
      release();
      if (blob.size === 0) {
        fail("Rekaman kosong: tidak ada suara yang terekam dari mikrofon.");
        return;
      }

      // 1. Save first (S3 + Postgres).
      const form = new FormData();
      form.append("audio", blob, "rekaman.wav");
      form.append(
        "meta",
        JSON.stringify({
          mode,
          pipeline: "batch",
          projectId: window.location.pathname.match(/\/project\/([^/]+)/)?.[1] ?? null,
          startedAt: new Date(startedAt).toISOString(),
          endedAt: new Date().toISOString(),
          transcript: [],
        })
      );
      let uuid: string;
      try {
        const res = await fetch("/api/voice/recording", { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.uuid) {
          fail(`${data.error || "Rekaman gagal disimpan."} (HTTP ${res.status})`);
          return;
        }
        uuid = data.uuid;
      } catch {
        fail("Rekaman gagal dikirim ke server.");
        return;
      }

      // 2. Then turn the saved recording into text.
      enterPhase("transcribing");
      let text = "";
      try {
        const res = await fetch("/api/voice/recording/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uuid, purpose: "batch" }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          fail(`Rekaman tersimpan, tapi gagal diubah jadi teks: ${data.error || `HTTP ${res.status}`}`);
          return;
        }
        text = String(data.aiTranscript?.text ?? "").trim();
      } catch {
        fail("Rekaman tersimpan, tapi layanan speech-to-text tidak bisa dihubungi.");
        return;
      }
      if (!text) {
        setRecording({ ok: false, message: "Rekaman tersimpan, tapi tidak ada ucapan yang terdengar." });
        enterPhase(null);
        if (mode === "command") onSessionEndRef.current?.(mode, [], Promise.resolve({ uuid }));
        return;
      }

      // 3. Use it: type it (Mode Menulis) or run it as commands (Mode Perintah).
      if (mode === "write") {
        enterPhase("typing");
        let result: VoiceCommandResult;
        try {
          // Trailing space so the next recording doesn't stick to this text.
          result = await onCommandRef.current("insert_text", { text: `${text} ` });
        } catch (err) {
          result = { ok: false, message: (err as Error)?.message || "Gagal menulis teks." };
        }
        setRecording(
          result.ok
            ? { ok: true, message: "Teks dari rekaman sudah diketik ke draft. Rekaman tersimpan di S3." }
            : { ok: false, message: `Rekaman tersimpan, tapi teksnya gagal diketik: ${result.message}` }
        );
        enterPhase(null);
        return;
      }
      setRecording({ ok: true, message: "Rekaman tersimpan di S3 dan sudah diubah jadi teks." });
      enterPhase(null);
      onSessionEndRef.current?.(mode, [text], Promise.resolve({ uuid }));
    },
    [enterPhase, fail, release]
  );

  const start = useCallback(
    async (mode: VoiceMode = "write") => {
      if (phaseRef.current) return;
      modeRef.current = mode;
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError(`Mikrofon diblokir browser karena halaman tidak aman (${window.location.origin}). Buka lewat HTTPS.`);
        return;
      }
      setError(null);
      setNotice(null);
      setRecording(null);
      setConnecting(true);
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        micRef.current = mic;
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.75;
        ctx.createMediaStreamSource(mic).connect(analyser);
        analyserRef.current = analyser;

        const { recorder } = await startSessionRecorder(mic);
        recorderRef.current = recorder;
        startedAtRef.current = Date.now();
        enterPhase("recording");
        const endsAt = Date.now() + MAX_SECONDS * 1000;
        setSecondsLeft(MAX_SECONDS);
        timerRef.current = setInterval(() => {
          const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
          setSecondsLeft(left);
          if (left <= 0) void finish("Batas 10 menit per rekaman tercapai, rekaman diproses.");
        }, 1000);
      } catch (err) {
        console.error("[rekam dulu] tidak bisa mulai:", err);
        release();
        const denied = (err as Error)?.name === "NotAllowedError";
        setError(denied ? "Izin mikrofon ditolak. Aktifkan mikrofon di browser." : (err as Error)?.message || "Gagal mulai merekam.");
        enterPhase(null);
      } finally {
        setConnecting(false);
      }
    },
    [enterPhase, finish, release]
  );

  const toggleMute = useCallback(() => {
    const track = micRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    recorderRef.current?.setMuted(!track.enabled);
    setMuted(!track.enabled);
  }, []);

  /** Leaving the page mid-recording drops it (nothing was saved yet). */
  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      recorderRef.current = null;
      void recorder?.stop().catch(() => {});
      release();
    },
    [release]
  );

  const getAnalysers = useCallback(() => ({ input: analyserRef.current, output: null as AnalyserNode | null }), []);

  const status: VoiceStatus = connecting ? "connecting" : phase === "recording" ? "listening" : phase ? "working" : error ? "error" : "idle";

  return {
    phase,
    status,
    error,
    muted,
    transcript: [] as VoiceTranscriptLine[],
    liveUser: "",
    liveAssistant: "",
    secondsLeft,
    notice,
    recording,
    finishing: false,
    saving: phase === "uploading",
    clearRecording: () => setRecording(null),
    active: phase === "recording",
    start,
    stop: () => void finish(),
    toggleMute,
    getAnalysers,
  };
}

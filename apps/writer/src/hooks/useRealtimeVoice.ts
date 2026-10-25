import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceCommandResult } from "@/components/PlateEditor";

export type VoiceStatus = "idle" | "connecting" | "listening" | "speaking" | "working" | "error";

export interface VoiceTranscriptLine {
  id: string;
  role: "user" | "assistant" | "tool";
  text: string;
  /** Tool lines only: running → ok / failed. */
  toolState?: "running" | "ok" | "failed";
  /** Tool lines only: the result message shown under the step. */
  detail?: string;
}

interface UseRealtimeVoiceOptions {
  /** Runs one function call from the voice model against the editor. */
  onCommand: (name: string, args: Record<string, unknown>) => Promise<VoiceCommandResult>;
}

const TOOL_LABELS: Record<string, string> = {
  continue_writing: "Melanjutkan tulisan",
  write_freely: "Menulis bebas",
  summarize_document: "Meringkas dokumen",
  rewrite_paragraph: "Menulis ulang paragraf",
  accept_ai_text: "Menerima teks AI",
  reject_ai_text: "Membatalkan teks AI",
  generate_with_ai: "Membuat konten AI",
  insert_generated_content: "Memasukkan hasil AI",
  close_ai_window: "Menutup jendela AI",
  undo: "Undo",
  redo: "Redo",
  go_to: "Pindah posisi",
  insert_text: "Dikte",
  add_block: "Menambah blok",
  get_outline: "Membaca kerangka",
  read_current_paragraph: "Membaca paragraf",
  ask_references: "Bertanya ke referensi",
};

export const voiceToolLabel = (name: string) => TOOL_LABELS[name] ?? name;

interface VoiceUsageTotals {
  inputText: number;
  inputAudio: number;
  inputCached: number;
  outputText: number;
  outputAudio: number;
}

const emptyUsage = (): VoiceUsageTotals => ({ inputText: 0, inputAudio: 0, inputCached: 0, outputText: 0, outputAudio: 0 });

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Realtime voice assistant over WebRTC (OpenAI Realtime API). Audio goes
 * browser ⇄ OpenAI directly; function calls arrive on the "oai-events" data
 * channel and are executed locally via `onCommand`.
 */
export function useRealtimeVoice({ onCommand }: UseRealtimeVoiceOptions) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState<VoiceTranscriptLine[]>([]);
  // Text that is still streaming in (user's words being transcribed, the
  // assistant's sentence being spoken) — shown live, then moved to `transcript`.
  const [liveUser, setLiveUser] = useState("");
  const [liveAssistant, setLiveAssistant] = useState("");
  // Spending limits (from /api/voice/session): the session is cut off when
  // its time runs out or nobody has spoken for a while.
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const usageIdRef = useRef<string | null>(null);
  const usageRef = useRef<VoiceUsageTotals>(emptyUsage());
  const lastActivityRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  const pushLine = useCallback((line: Omit<VoiceTranscriptLine, "id"> & { id?: string }) => {
    if (!line.text.trim()) return;
    setTranscript(prev => [...prev, { ...line, id: line.id ?? newId(), text: line.text.trim() }].slice(-40));
  }, []);

  const updateLine = useCallback((id: string, patch: Partial<VoiceTranscriptLine>) => {
    setTranscript(prev => prev.map(line => (line.id === id ? { ...line, ...patch } : line)));
  }, []);

  const send = useCallback((event: Record<string, unknown>) => {
    const dc = dcRef.current;
    if (dc?.readyState === "open") dc.send(JSON.stringify(event));
  }, []);

  const createAnalyser = (stream: MediaStream) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return null;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.75;
    ctx.createMediaStreamSource(stream).connect(analyser);
    return analyser;
  };

  const reportUsage = useCallback((final: boolean) => {
    const usageId = usageIdRef.current;
    if (!usageId) return;
    if (final) usageIdRef.current = null;
    void fetch("/api/voice/usage", {
      method: "POST",
      body: JSON.stringify({ usageId, final, usage: usageRef.current }),
      // Lets the final report survive the page being closed.
      keepalive: true,
    }).catch(() => {});
  }, []);

  const stop = useCallback((reason?: string) => {
    reportUsage(true);
    if (timerRef.current) clearInterval(timerRef.current);
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    timerRef.current = null;
    heartbeatRef.current = null;
    setSecondsLeft(null);
    if (reason) setNotice(reason);
    dcRef.current?.close();
    pcRef.current?.getSenders().forEach(sender => sender.track?.stop());
    pcRef.current?.close();
    micRef.current?.getTracks().forEach(track => track.stop());
    if (audioRef.current) audioRef.current.srcObject = null;
    void audioCtxRef.current?.close().catch(() => {});
    dcRef.current = null;
    pcRef.current = null;
    micRef.current = null;
    audioCtxRef.current = null;
    inputAnalyserRef.current = null;
    outputAnalyserRef.current = null;
    setMuted(false);
    setLiveUser("");
    setLiveAssistant("");
    setStatus(prev => (prev === "error" ? prev : "idle"));
  }, [reportUsage]);

  const runFunctionCalls = useCallback(
    async (calls: { call_id: string; name: string; arguments?: string }[]) => {
      setStatus("working");
      lastActivityRef.current = Date.now();
      for (const call of calls) {
        let args: Record<string, unknown> = {};
        try {
          args = call.arguments ? JSON.parse(call.arguments) : {};
        } catch {
          // Malformed arguments — let the command report what's missing.
        }
        const lineId = newId();
        pushLine({ id: lineId, role: "tool", text: voiceToolLabel(call.name), toolState: "running" });
        let result: VoiceCommandResult;
        try {
          result = await onCommandRef.current(call.name, args);
        } catch (err: any) {
          result = { ok: false, message: err?.message || "Perintah gagal dijalankan." };
        }
        updateLine(lineId, { toolState: result.ok ? "ok" : "failed", detail: result.message });
        send({
          type: "conversation.item.create",
          item: { type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) },
        });
      }
      // One spoken follow-up for the whole batch of calls.
      lastActivityRef.current = Date.now();
      send({ type: "response.create" });
      setStatus(prev => (prev === "working" ? "listening" : prev));
    },
    [pushLine, updateLine, send]
  );

  const handleEvent = useCallback(
    (event: any) => {
      switch (event.type) {
        case "input_audio_buffer.speech_started":
          lastActivityRef.current = Date.now();
          setStatus("listening");
          break;
        case "output_audio_buffer.started":
          lastActivityRef.current = Date.now();
          setStatus("speaking");
          break;
        case "output_audio_buffer.stopped":
          lastActivityRef.current = Date.now();
          setStatus(prev => (prev === "speaking" ? "listening" : prev));
          break;
        case "conversation.item.input_audio_transcription.delta":
          setLiveUser(prev => prev + (event.delta ?? ""));
          break;
        case "conversation.item.input_audio_transcription.completed":
          setLiveUser("");
          pushLine({ role: "user", text: event.transcript ?? "" });
          break;
        case "response.output_audio_transcript.delta":
          setLiveAssistant(prev => prev + (event.delta ?? ""));
          break;
        case "response.output_audio_transcript.done":
          setLiveAssistant("");
          pushLine({ role: "assistant", text: event.transcript ?? "" });
          break;
        case "response.done": {
          addUsage(usageRef.current, event.response?.usage);
          const calls = (event.response?.output ?? []).filter((item: any) => item.type === "function_call");
          if (calls.length) void runFunctionCalls(calls);
          break;
        }
        case "error":
          console.error("Realtime error:", event.error);
          setError(event.error?.message ?? "Terjadi kesalahan pada sesi suara.");
          break;
      }
    },
    [pushLine, runFunctionCalls]
  );

  const start = useCallback(async () => {
    if (pcRef.current) return;
    // Browsers only expose the mic on HTTPS or localhost.
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError(
        `Mikrofon diblokir browser karena halaman tidak aman (${window.location.origin}). Buka lewat HTTPS, atau untuk development izinkan origin ini di chrome://flags/#unsafely-treat-insecure-origin-as-secure.`
      );
      setStatus("error");
      return;
    }
    setError(null);
    setNotice(null);
    setStatus("connecting");
    try {
      const tokenRes = await fetch("/api/voice/session", { method: "POST" });
      const token = await tokenRes.json();
      if (!tokenRes.ok || !token.value) throw new Error(token.error || "Gagal membuat sesi suara.");
      usageIdRef.current = token.usageId ?? null;
      usageRef.current = emptyUsage();

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      // Only used to read levels for the waveform, never routed to speakers.
      audioCtxRef.current = new AudioContext();

      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.autoplay = true;
      }
      pc.ontrack = e => {
        if (audioRef.current) audioRef.current.srcObject = e.streams[0];
        outputAnalyserRef.current = createAnalyser(e.streams[0]);
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          setError("Koneksi suara terputus.");
          setStatus("error");
          stop();
        }
      };

      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micRef.current = mic;
      inputAnalyserRef.current = createAnalyser(mic);
      pc.addTrack(mic.getTracks()[0], mic);

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onopen = () => {
        setStatus("listening");
        const sessionSeconds: number = token.limits?.sessionSeconds ?? 600;
        const idleSeconds: number = token.limits?.idleTimeoutSeconds ?? 60;
        const endsAt = Date.now() + sessionSeconds * 1000;
        lastActivityRef.current = Date.now();
        setSecondsLeft(sessionSeconds);
        timerRef.current = setInterval(() => {
          const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
          setSecondsLeft(left);
          if (left <= 0) {
            stop("Batas waktu sesi habis, mic dimatikan otomatis. Nyalakan lagi untuk sesi baru.");
          } else if (Date.now() - lastActivityRef.current > idleSeconds * 1000) {
            stop(`Tidak ada suara selama ${idleSeconds} detik, mic dimatikan otomatis untuk menghemat biaya.`);
          }
        }, 1000);
        heartbeatRef.current = setInterval(() => reportUsage(false), 30_000);
      };
      dc.onmessage = e => {
        try {
          handleEvent(JSON.parse(e.data));
        } catch (err) {
          console.error("Bad realtime event:", err);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: { Authorization: `Bearer ${token.value}`, "Content-Type": "application/sdp" },
      });
      if (!sdpRes.ok) throw new Error(`Gagal terhubung ke layanan suara (${sdpRes.status}).`);
      await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });
    } catch (err: any) {
      console.error("Voice start failed:", err);
      const denied = err?.name === "NotAllowedError";
      setError(denied ? "Izin mikrofon ditolak. Aktifkan mikrofon di browser." : err?.message || "Gagal memulai suara.");
      setStatus("error");
      stop();
    }
  }, [handleEvent, stop, reportUsage]);

  const toggleMute = useCallback(() => {
    const track = micRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }, []);

  /** Cuts the assistant off mid-sentence. */
  const interrupt = useCallback(() => {
    send({ type: "response.cancel" });
    send({ type: "output_audio_buffer.clear" });
  }, [send]);

  /** Live analysers for the waveform (read every animation frame, no re-render). */
  const getAnalysers = useCallback(
    () => ({ input: inputAnalyserRef.current, output: outputAnalyserRef.current }),
    []
  );

  useEffect(() => {
    const onPageHide = () => reportUsage(true);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      stop();
    };
  }, [stop, reportUsage]);

  return {
    status,
    error,
    muted,
    transcript,
    liveUser,
    liveAssistant,
    secondsLeft,
    notice,
    active: status !== "idle" && status !== "error",
    start,
    stop: () => stop(),
    toggleMute,
    interrupt,
    getAnalysers,
    clearTranscript: () => setTranscript([]),
  };
}

/** Adds one response's `usage` (Realtime API) to the running totals. */
function addUsage(totals: VoiceUsageTotals, usage: any) {
  if (!usage) return;
  const input = usage.input_token_details ?? {};
  const output = usage.output_token_details ?? {};
  const cached = input.cached_tokens_details ?? {};
  const cachedText = cached.text_tokens ?? 0;
  const cachedAudio = cached.audio_tokens ?? 0;
  totals.inputText += Math.max(0, (input.text_tokens ?? 0) - cachedText);
  totals.inputAudio += Math.max(0, (input.audio_tokens ?? 0) - cachedAudio);
  totals.inputCached += input.cached_tokens ?? cachedText + cachedAudio;
  totals.outputText += output.text_tokens ?? 0;
  totals.outputAudio += output.audio_tokens ?? 0;
}

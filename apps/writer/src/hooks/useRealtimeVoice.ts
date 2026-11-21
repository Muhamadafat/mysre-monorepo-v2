import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceCommandResult } from "@/components/PlateEditor";
import { startSessionRecorder, type SessionRecorder } from "@/lib/voice/sessionRecorder";
import { notifications } from "@mantine/notifications";

export type VoiceStatus = "idle" | "connecting" | "listening" | "speaking" | "working" | "error";

/**
 * "command": spoken commands are only transcribed during the session (no
 * answer, nothing runs); when the session ends they are handed to
 * `onSessionEnd`, which runs them. They are also saved with the recording and
 * can be run again from the history (Rekaman Mode Perintah → "Jalankan").
 * "write": dictation — every finished sentence is typed at the cursor, the
 * model never answers (cheaper: only input audio + transcription).
 */
export type VoiceMode = "command" | "write";

export interface VoiceTranscriptLine {
  id: string;
  role: "user" | "assistant" | "tool";
  text: string;
  /** Tool lines only: running → ok / failed. */
  toolState?: "running" | "ok" | "failed";
  /** Tool lines only: the result message shown under the step. */
  detail?: string;
}

/** Where a session's recording was saved: its UUID. */
export interface SavedRecording {
  uuid: string;
}

interface UseRealtimeVoiceOptions {
  /** Runs one function call from the voice model against the editor. */
  onCommand: (name: string, args: Record<string, unknown>) => Promise<VoiceCommandResult>;
  /**
   * Called once when a session ends normally (stop pressed, time limit, idle)
   * with what the user said, in order, and the recording's upload (resolves
   * to null when it wasn't saved). Not called on errors or unmount.
   */
  onSessionEnd?: (mode: VoiceMode, userLines: string[], saved: Promise<SavedRecording | null>) => void;
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
export function useRealtimeVoice({ onCommand, onSessionEnd }: UseRealtimeVoiceOptions) {
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
  // Where the last session's recording was saved (relative path), or why not.
  const [recording, setRecording] = useState<{ ok: boolean; message: string } | null>(null);
  /** Stop pressed: waiting for the last sentence's transcript. */
  const [finishing, setFinishing] = useState(false);
  /** The finished recording is being uploaded to S3. */
  const [saving, setSaving] = useState(false);

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
  const modeRef = useRef<VoiceMode>("command");
  // Session recording: mic (+ AI voice in command mode) mixed into one track.
  const recorderRef = useRef<SessionRecorder | null>(null);
  /** Why WAV capture wasn't used for this session (fallback recorder), if so. */
  const fallbackReasonRef = useRef<string | null>(null);
  const recordStartRef = useRef(0);
  /** Upload of the session that just stopped (handed to onSessionEnd). */
  const savedRef = useRef<Promise<SavedRecording | null>>(Promise.resolve(null));
  /** Why the recorder couldn't start (reported when the session stops). */
  const recordFailedRef = useRef<string | null>(null);
  const sessionLogRef = useRef<{ at: number; role: string; text: string }[]>([]);
  /** The user is speaking right now (between VAD speech_started and speech_stopped). */
  const speakingRef = useRef(false);
  /** Speech heard whose transcript hasn't arrived yet. */
  const transcriptPendingRef = useRef(false);
  const finishingRef = useRef(false);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;
  const onSessionEndRef = useRef(onSessionEnd);
  onSessionEndRef.current = onSessionEnd;

  const pushLine = useCallback((line: Omit<VoiceTranscriptLine, "id"> & { id?: string }) => {
    if (!line.text.trim()) return;
    sessionLogRef.current.push({ at: Date.now(), role: line.role, text: line.text.trim() });
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

  /**
   * Shows where the recording went, both in the dock and as a toast: the
   * dock hides when the cursor leaves the editor, so a failure there alone
   * is easy to miss.
   */
  const reportRecording = useCallback((ok: boolean, message: string) => {
    setRecording({ ok, message });
    notifications.show({
      title: ok ? "Rekaman tersimpan" : "Rekaman tidak tersimpan",
      message: ok ? `${message} Lihat di Riwayat Aktivitas → Rekaman.` : message,
      color: ok ? "teal" : "red",
      autoClose: ok ? 5000 : 12000,
    });
  }, []);

  /** Sends the finished recording + transcript to the server (stored in S3). */
  const uploadRecording = useCallback(async (blob: Blob, mode: VoiceMode, startedAt: number): Promise<SavedRecording | null> => {
    const log = sessionLogRef.current;
    sessionLogRef.current = [];
    if (blob.size === 0) {
      reportRecording(false, "Rekaman kosong: tidak ada suara yang terekam dari mikrofon.");
      return null;
    }
    const form = new FormData();
    form.append("audio", blob, "rekaman.mp3");
    form.append(
      "meta",
      JSON.stringify({
        mode,
        // The draft page's project (/project/<id>/draft): the history lists recordings per project.
        projectId: window.location.pathname.match(/\/project\/([^/]+)/)?.[1] ?? null,
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date().toISOString(),
        transcript: log.map(entry => ({ ...entry, at: new Date(entry.at).toISOString() })),
      })
    );
    try {
      const res = await fetch("/api/voice/recording", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) console.error("[rekaman] upload gagal:", res.status, data);
      reportRecording(
        res.ok,
        res.ok
          ? fallbackReasonRef.current
            ? `Rekaman tersimpan di S3 (format ${blob.type || "WebM"}, tanpa WAV/MP3 karena perekam WAV gagal: ${fallbackReasonRef.current}).`
            : `${data.mp3Failed ? "Rekaman WAV tersimpan di S3, tapi salinan MP3 gagal dibuat." : "Rekaman tersimpan di S3 (WAV + MP3)."}${
                mode === "command" ? " Perintahnya bisa dijalankan ulang dari Riwayat Aktivitas → Rekaman Mode Perintah." : ""
              }`
          : `${data.error || "Rekaman gagal disimpan."} (HTTP ${res.status})`
      );
      // The recording UUID: what the recordings API and its routes take.
      return res.ok && data.uuid ? { uuid: data.uuid } : null;
    } catch (err) {
      console.error("[rekaman] upload gagal:", err);
      reportRecording(false, "Rekaman gagal dikirim ke server.");
      return null;
    }
  }, [reportRecording]);

  const stop = useCallback((reason?: string) => {
    reportUsage(true);
    // The recorder has its own audio context; stop() resolves with the
    // finished WAV, which is uploaded (the server adds the MP3 copy).
    const recorder = recorderRef.current;
    recorderRef.current = null;
    savedRef.current = Promise.resolve(null);
    if (recorder) {
      const mode = modeRef.current;
      const startedAt = recordStartRef.current;
      setSaving(true);
      savedRef.current = recorder
        .stop()
        .then(blob => uploadRecording(blob, mode, startedAt))
        .finally(() => setSaving(false))
        .catch((err): null => {
          console.error("[rekaman] perekam gagal berhenti:", err);
          sessionLogRef.current = [];
          // Cancelled before the recorder had started: nothing was recorded, nothing to report.
          if ((err as Error)?.name !== "CancelStartError") {
            reportRecording(false, `Perekam gagal: ${(err as Error)?.message || "error tidak diketahui"}.`);
          }
          return null;
        });
    } else if (recordFailedRef.current) {
      reportRecording(false, `Perekaman tidak berjalan: ${recordFailedRef.current}`);
    }
    recordFailedRef.current = null;
    finishingRef.current = false;
    setFinishing(false);
    speakingRef.current = false;
    transcriptPendingRef.current = false;
    void audioCtxRef.current?.close().catch(() => {});
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
  }, [reportUsage, uploadRecording, reportRecording]);

  /** Normal end of a session: stops it, then hands what the user said to onSessionEnd. */
  const endSession = useCallback(
    (reason?: string) => {
      const mode = modeRef.current;
      const userLines = sessionLogRef.current.filter(entry => entry.role === "user").map(entry => entry.text);
      stop(reason);
      onSessionEndRef.current?.(mode, userLines, savedRef.current);
    },
    [stop]
  );

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

  /** Write mode: types one finished transcript at the cursor. */
  const dictate = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      lastActivityRef.current = Date.now();
      const lineId = newId();
      pushLine({ id: lineId, role: "tool", text: `Menulis: ${text}`, toolState: "running" });
      let result: VoiceCommandResult;
      try {
        // Trailing space so the next sentence doesn't stick to this one.
        result = await onCommandRef.current("insert_text", { text: `${text} ` });
      } catch (err) {
        result = { ok: false, message: (err as Error)?.message || "Gagal menulis teks." };
      }
      updateLine(lineId, { toolState: result.ok ? "ok" : "failed", detail: result.ok ? text : result.message });
    },
    [pushLine, updateLine]
  );

  const handleEvent = useCallback(
    (event: any) => {
      switch (event.type) {
        case "input_audio_buffer.speech_started":
          lastActivityRef.current = Date.now();
          speakingRef.current = true;
          transcriptPendingRef.current = true;
          if (!finishingRef.current) setStatus("listening");
          break;
        case "input_audio_buffer.speech_stopped":
        case "input_audio_buffer.committed":
          speakingRef.current = false;
          break;
        case "conversation.item.input_audio_transcription.failed":
          transcriptPendingRef.current = false;
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
          transcriptPendingRef.current = false;
          setLiveUser("");
          if (modeRef.current === "write") {
            void dictate(event.transcript ?? "");
          } else {
            pushLine({ role: "user", text: event.transcript ?? "" });
          }
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
          // Stop pressed right after the server had already committed the
          // turn itself: the buffer is empty and the commit is refused.
          // Harmless: that turn's transcript still arrives, so just don't show it.
          if (event.error?.code === "input_audio_buffer_commit_empty" || /buffer too small/i.test(event.error?.message ?? "")) {
            break;
          }
          console.error("Realtime error:", event.error);
          setError(event.error?.message ?? "Terjadi kesalahan pada sesi suara.");
          break;
      }
    },
    [pushLine, runFunctionCalls, dictate]
  );

  /**
   * Records the session for storage (see lib/voice/sessionRecorder): WAV 16 kHz
   * (the server adds an MP3 copy), otherwise the browser's own recorder.
   * Only the user's voice is recorded; the AI's replies are in the transcript JSON.
   */
  async function startRecording(mic: MediaStream) {
    fallbackReasonRef.current = null;
    try {
      const { recorder, fallbackReason } = await startSessionRecorder(mic);
      // The session may have ended while the encoder was starting.
      if (micRef.current !== mic) {
        void recorder.stop().catch(() => {});
        return;
      }
      fallbackReasonRef.current = fallbackReason ?? null;
      recorderRef.current = recorder;
      recordStartRef.current = Date.now();
    } catch (err) {
      console.error("[rekaman] perekam tidak bisa dimulai:", err);
      recorderRef.current = null;
      // Reported when the session stops (the voice session itself keeps working).
      recordFailedRef.current = (err as Error)?.message || "mikrofon/encoder tidak tersedia";
    }
  }

  const start = useCallback(async (mode: VoiceMode = "command") => {
    if (pcRef.current) return;
    modeRef.current = mode;
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
    setRecording(null);
    sessionLogRef.current = [];
    setStatus("connecting");
    try {
      const tokenRes = await fetch("/api/voice/session", { method: "POST", body: JSON.stringify({ mode }) });
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
      void startRecording(mic);
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
            endSession("Batas waktu sesi habis, mic dimatikan otomatis. Nyalakan lagi untuk sesi baru.");
          } else if (Date.now() - lastActivityRef.current > idleSeconds * 1000) {
            endSession(`Tidak ada suara selama ${idleSeconds} detik, mic dimatikan otomatis untuk menghemat biaya.`);
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
  }, [handleEvent, stop, endSession, reportUsage]);

  const toggleMute = useCallback(() => {
    const track = micRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    // Silence the recording too while muted.
    recorderRef.current?.setMuted(!track.enabled);
    setMuted(!track.enabled);
  }, []);

  /**
   * The stop button: the transcript of the last thing said only arrives after
   * the user stops speaking, so closing straight away loses it (the last
   * dictated sentence isn't typed, the recording's transcript is empty).
   * Mute the mic, close the user's turn, wait up to 4 s for that transcript,
   * then stop. Errors and time limits still stop immediately via stop().
   */
  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open" || !transcriptPendingRef.current) {
      endSession();
      return;
    }
    finishingRef.current = true;
    setFinishing(true);
    setStatus("working");
    setNotice("Menyimpan kalimat terakhir…");
    const track = micRef.current?.getAudioTracks()[0];
    if (track) track.enabled = false; // nothing new gets in while we wait
    // Still mid-sentence: end the user's turn so it gets transcribed now.
    if (speakingRef.current) send({ type: "input_audio_buffer.commit" });
    const deadline = Date.now() + 4000;
    while (transcriptPendingRef.current && Date.now() < deadline && dcRef.current === dc) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    // Let the dictation insert / transcript line land first.
    await new Promise(resolve => setTimeout(resolve, 150));
    setNotice(null);
    endSession();
  }, [endSession, send]);

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
    recording,
    finishing,
    saving,
    clearRecording: () => setRecording(null),
    active: status !== "idle" && status !== "error",
    start,
    stop: () => void finish(),
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

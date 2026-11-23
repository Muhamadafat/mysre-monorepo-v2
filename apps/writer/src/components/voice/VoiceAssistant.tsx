"use client";

import { useEffect, useRef, useState, type ComponentType, type RefObject } from "react";
import { ActionIcon, Loader, Portal, Tooltip } from "@mantine/core";
import {
  IconBolt,
  IconCheck,
  IconChevronRight,
  IconCloudUpload,
  IconMicrophone,
  IconMicrophoneOff,
  IconPencil,
  IconPlayerStopFilled,
  IconPower,
  IconQuestionMark,
  IconTerminal2,
  IconX,
} from "@tabler/icons-react";
import type { VoiceCommandResult } from "@/components/PlateEditor";
import { useBatchVoice } from "@/hooks/useBatchVoice";
import { useRealtimeVoice, type SavedRecording, type VoiceMode } from "@/hooks/useRealtimeVoice";
import { pushTestLog } from "@/lib/testLog";
import CommandHelpModal from "./CommandHelpModal";
import { logCommandRun, runSpokenCommand, type CommandProgress } from "./runSpokenCommand";
import { EDITOR_SELECTOR, useParagraphAnchor } from "./useParagraphAnchor";
import VoiceWaveform from "./VoiceWaveform";
import classes from "./VoiceAssistant.module.css";

interface VoiceAssistantProps {
  /** Runs one voice-model function call against the editor. */
  onCommand: (name: string, args: Record<string, unknown>) => Promise<VoiceCommandResult>;
}

/** Records every voice command and its result in the manual-test log. */
const loggedCommand =
  (onCommand: VoiceAssistantProps["onCommand"]): VoiceAssistantProps["onCommand"] =>
  async (name, args) => {
    const start = performance.now();
    const ts = new Date().toISOString();
    const result = await onCommand(name, args);
    pushTestLog({
      ts,
      feature: `Suara: ${name}`,
      status: result.ok ? "ok" : "gagal",
      durationMs: Math.round(performance.now() - start),
      detail: result.message,
    });
    return result;
  };

type ToggleValue = "command" | "off" | "write";

const MODE_LABEL: Record<VoiceMode, string> = { command: "Mode Perintah", write: "Mode Menulis" };
/** Short name shown inside the power pill once a mode is on. */
const MODE_SHORT: Record<VoiceMode, string> = { command: "Perintah", write: "Menulis" };

/** The choices in the power bubble's drop-down list. */
const MODE_OPTIONS: { value: VoiceMode; title: string; hint: string; icon: ComponentType<{ size?: number }>; className: string }[] = [
  { value: "write", title: "Mode Menulis", hint: "Ucapan Anda diketik ke draft", icon: IconPencil, className: classes.optWrite },
  { value: "command", title: "Mode Perintah", hint: "Perintah dijalankan saat Anda berhenti", icon: IconTerminal2, className: classes.optCommand },
];

/**
 * How speech becomes text. "realtime": live while speaking (OpenAI Realtime).
 * "batch" ("Rekam dulu"): record until stop, save the recording to S3, then a
 * speech-to-text service turns the saved file into text — for services
 * without a realtime API. "batch" is the default (lecturer's decision,
 * 2026-11-23); a user's own choice is remembered per browser.
 */
type VoiceEngine = "realtime" | "batch";
const ENGINE_KEY = "sre.voice.engine";
const ENGINE_OPTIONS: { value: VoiceEngine; title: string; hint: string; icon: ComponentType<{ size?: number }> }[] = [
  { value: "batch", title: "Rekam dulu", hint: "Rekaman disimpan dulu, lalu diubah jadi teks (default)", icon: IconCloudUpload },
  { value: "realtime", title: "Realtime", hint: "Teks muncul saat Anda bicara", icon: IconBolt },
];

/** The steps shown while a session runs and after it ends ("Langkah n/N"). */
const STEPS: Record<VoiceEngine, Record<VoiceMode, string[]>> = {
  realtime: {
    write: ["Mendengarkan & mengetik", "Menyimpan kalimat terakhir", "Menyimpan rekaman"],
    command: ["Mendengarkan perintah", "Menyimpan kalimat terakhir", "Memahami perintah", "Menjalankan perintah"],
  },
  batch: {
    write: ["Merekam", "Menyimpan rekaman ke S3", "Mengubah suara jadi teks", "Mengetik ke draft"],
    command: ["Merekam", "Menyimpan rekaman ke S3", "Mengubah suara jadi teks", "Memahami perintah", "Menjalankan perintah"],
  },
};

/**
 * True while the cursor is in the draft editor (or the dock itself is being
 * used). Clicking anywhere else — a toolbar button that takes focus, a modal,
 * empty page space — turns it off; toolbar buttons that keep the editor
 * focused don't.
 */
function useEditorFocus(dockRef: RefObject<HTMLElement | null>): boolean {
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    const inDock = (node: EventTarget | null) => node instanceof Node && Boolean(dockRef.current?.contains(node));
    const inEditor = (node: EventTarget | null) => node instanceof Element && Boolean(node.closest(EDITOR_SELECTOR));
    let timer = 0;
    const onPointer = (event: PointerEvent) => {
      if (inDock(event.target)) return setFocused(true);
      if (inEditor(event.target)) return setFocused(true);
      // Let the click settle: a toolbar button may keep the editor focused.
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setFocused(inEditor(document.activeElement)), 0);
    };
    const onFocus = (event: FocusEvent) => setFocused(inDock(event.target) || inEditor(event.target));
    // Already in the editor when the dock mounts.
    setFocused(inEditor(document.activeElement));
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("focusin", onFocus);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("focusin", onFocus);
    };
  }, [dockRef]);
  return focused;
}

/**
 * Realtime voice assistant as one floating dock, not in the toolbar. It sits
 * in the editor's right margin next to the cursor's paragraph (bottom-center
 * when there's no room), and holds still while recording.
 * A power bubble opens a small list (menulis / perintah / matikan); once a
 * mode is picked, one record/stop button (mic, ■ while recording) and a "?"
 * button (help pop-up: command list from the DB, flows, usage) appear next to the bubble. While recording and afterwards the
 * dock shows a waveform, the current step ("Langkah n/N"), one line of
 * what's happening, time left and mute. In Mode Perintah, stopping runs the
 * spoken commands right away. Every session is recorded and saved to S3.
 */
export default function VoiceAssistant({ onCommand }: VoiceAssistantProps) {
  const run = loggedCommand(onCommand);
  // Mode Perintah: what happens to the spoken commands after stop.
  const [progress, setProgress] = useState<CommandProgress | null>(null);
  const cancelRunRef = useRef(false);
  const [heard, setHeard] = useState("");
  // The dock renders in a Portal (client only), so reading storage here can't mismatch the server render.
  const [engine, setEngine] = useState<VoiceEngine>(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem(ENGINE_KEY) === "realtime" ? "realtime" : "batch";
    } catch {
      return "batch"; // storage blocked: the default
    }
  });
  // Stop pressed (or time limit): run what was said in Mode Perintah right away.
  const onSessionEnd = (endedMode: VoiceMode, userLines: string[], saved: Promise<SavedRecording | null>) => {
      // Switching mode / turning voice off mid-session cancels instead of running.
      if (endedMode !== "command" || cancelRunRef.current) {
        cancelRunRef.current = false;
        return;
      }
      const text = userLines.join("\n").trim();
      if (!text) {
        setProgress({ stage: "done", ok: false, message: "Tidak ada perintah yang terdengar." });
        return;
      }
      setHeard(userLines.join(" "));
      // Once both are done, the result is logged with the recording (intent / actions in the recordings API).
      void Promise.all([runSpokenCommand(text, run, setProgress), saved]).then(([result, recording]) => {
        if (recording) void logCommandRun(recording.uuid, result, "langsung");
      });
  };
  const realtime = useRealtimeVoice({ onCommand: run, onSessionEnd });
  const batch = useBatchVoice({ onCommand: run, onSessionEnd });
  const voice = engine === "batch" ? batch : realtime;
  /** "Rekam dulu" after stop: saving, transcribing or typing. */
  const batchWorking = engine === "batch" && batch.phase !== null && batch.phase !== "recording";
  const [dismissed, setDismissed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [toggle, setToggle] = useState<ToggleValue>("off");
  const mode: VoiceMode | null = toggle === "off" ? null : toggle;
  const [menuOpen, setMenuOpen] = useState(false);
  // Follows the cursor's paragraph in the editor margin; locked while recording.
  const dockRef = useRef<HTMLDivElement>(null);
  const editorFocused = useEditorFocus(dockRef);

  // The mode list closes on a click outside the dock or Escape (the help pop-up closes itself).
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const onPointer = (event: PointerEvent) => {
      if (!dockRef.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // A new error / notice / saved-recording message shows the status part again.
  useEffect(() => {
    // A saved recording alone doesn't bring a hidden status back (it has its own toast).
    if (voice.error || voice.notice || (voice.recording && !voice.recording.ok) || progress) setDismissed(false);
  }, [voice.error, voice.notice, voice.recording, progress]);

  const lastLine = voice.transcript[voice.transcript.length - 1];
  const runningStep = [...voice.transcript].reverse().find(line => line.toolState === "running");
  const busy = voice.active || voice.status === "connecting";
  // Commands from the last session are being interpreted / run (or, in "Rekam dulu", the recording is being processed).
  const processing = progress?.stage === "interpreting" || progress?.stage === "running" || batchWorking;
  const steps = mode ? STEPS[engine][mode] : [];

  // Which step the dock is on (null: connecting, idle, or finished).
  let step: { index: number; label: string } | null = null;
  // "Rekam dulu" in Mode Perintah has one more step (transcribe) before the commands.
  const commandOffset = engine === "batch" ? 1 : 0;
  if (mode && voice.status !== "connecting") {
    if (engine === "batch" && batch.phase) {
      const index = { recording: 1, uploading: 2, transcribing: 3, typing: 4 }[batch.phase];
      step = { index, label: steps[index - 1] };
    } else if (voice.finishing) step = { index: 2, label: steps[1] };
    else if (voice.active) step = { index: 1, label: steps[0] };
    else if (mode === "command" && progress?.stage === "interpreting") step = { index: 3 + commandOffset, label: steps[2 + commandOffset] };
    else if (mode === "command" && progress?.stage === "running")
      step = {
        index: 4 + commandOffset,
        label: progress.total > 1 ? `${steps[3 + commandOffset]} ${progress.index}/${progress.total}` : steps[3 + commandOffset],
      };
    else if (mode === "write" && voice.saving) step = { index: 3, label: steps[2] };
  }

  // One line that says what is happening right now.
  let caption: string;
  let tone: "normal" | "warn" | "error" | "ok" = "normal";
  if (voice.error) {
    caption = voice.error;
    tone = "error";
  } else if (engine === "batch" && batch.phase === "uploading") {
    caption = "Menyimpan rekaman ke S3…";
  } else if (engine === "batch" && batch.phase === "transcribing") {
    caption = "Mengubah suara jadi teks…";
  } else if (engine === "batch" && batch.phase === "typing") {
    caption = "Mengetik teks ke draft…";
  } else if (engine === "batch" && batch.phase === "recording" && !voice.muted) {
    caption = "Merekam… tekan ■ kalau sudah selesai bicara";
  } else if (!busy && progress?.stage === "interpreting") {
    caption = heard ? `\u201c${heard}\u201d` : "Memahami perintah…";
  } else if (!busy && progress?.stage === "running") {
    caption = `${progress.label}…`;
  } else if (!busy && progress?.stage === "done") {
    caption = `${progress.ok ? "✓" : "✗"} ${progress.message}`;
    tone = progress.ok ? "ok" : "error";
  } else if (!busy && voice.saving) {
    caption = "Menyimpan rekaman ke S3…";
  } else if (!busy && voice.recording) {
    caption = voice.recording.message;
    tone = voice.recording.ok ? "ok" : "error";
  } else if (voice.notice && !voice.active) {
    caption = voice.notice;
    tone = "warn";
  } else if (voice.liveUser) {
    caption = voice.liveUser;
  } else if (voice.liveAssistant) {
    caption = voice.liveAssistant;
  } else if (runningStep) {
    caption = `${runningStep.text}…`;
  } else if (voice.status === "connecting") {
    caption = "Menghubungkan…";
  } else if (lastLine?.role === "tool") {
    caption = `${lastLine.toolState === "failed" ? "✗" : "✓"} ${lastLine.detail ?? lastLine.text}`;
  } else if (lastLine?.role === "assistant") {
    caption = lastLine.text;
  } else if (voice.muted) {
    caption = "Mikrofon dibisukan";
  } else {
    caption = mode === "write" ? "Silakan bicara, ucapan Anda akan diketik…" : "Silakan bicara…";
  }

  const meta = step
    ? `Langkah ${step.index}/${steps.length} · ${step.label}`
    : voice.status === "speaking"
      ? "AI berbicara"
      : voice.status === "working"
        ? "Mengerjakan"
        : voice.active
          ? voice.muted
            ? "Dibisukan"
            : mode === "write"
              ? "Menulis"
              : "Mendengarkan"
          : "Asisten suara";
  const timeLeft =
    voice.secondsLeft !== null ? `${Math.floor(voice.secondsLeft / 60)}:${String(voice.secondsLeft % 60).padStart(2, "0")}` : null;

  const position = useParagraphAnchor(dockRef, busy);

  const hasMessage = Boolean(voice.error || voice.notice || voice.recording || progress);
  const working = busy || processing || voice.saving;
  const showStatus = working || (hasMessage && !dismissed);

  // Finished fine: show the ✓ briefly, then hide the floating status (the
  // result is also in a notification). Errors and warnings stay until closed.
  const finishedOk = !working && hasMessage && !dismissed && tone === "ok";
  useEffect(() => {
    if (!finishedOk) return;
    const timer = window.setTimeout(() => setDismissed(true), 2500);
    return () => window.clearTimeout(timer);
  }, [finishedOk, caption]);

  // Moving the toggle always ends the running session: a session is opened
  // for one mode (its tools/behaviour are fixed when it starts).
  const changeToggle = (value: ToggleValue) => {
    if (busy && value !== toggle) {
      cancelRunRef.current = true;
      voice.stop();
    }
    setToggle(value);
    setMenuOpen(false);
  };

  const record = () => {
    if (!mode || busy || processing) return;
    setDismissed(false);
    setProgress(null);
    setHeard("");
    void voice.start(mode);
  };

  const stopLabel =
    engine === "batch"
      ? "Berhenti & proses rekaman"
      : mode === "command"
        ? "Berhenti & jalankan perintah"
        : "Berhenti merekam";

  const changeEngine = (value: VoiceEngine) => {
    if (busy || processing || value === engine) return;
    setEngine(value);
    try {
      window.localStorage.setItem(ENGINE_KEY, value);
    } catch {
      // Storage blocked: the choice lasts until the page reloads.
    }
  };

  const anchored = position.kind === "anchored";
  // Only shown while the cursor is in the editor, mid-session or while the
  // last session's commands are still running. While the help pop-up is open
  // the whole dock is hidden so nothing covers it (recording keeps going).
  const visible = !helpOpen && (editorFocused || menuOpen || working);
  const hiddenClass = visible ? "" : classes.dockHidden;
  const modeClass = mode === "write" ? classes.modeWrite : mode === "command" ? classes.modeCommand : "";
  const statusPart = showStatus ? (
    <div className={classes.status} role="status" aria-live="polite">
      <div className={`${classes.orb} ${voice.active || processing || voice.saving ? classes.orbActive : ""}`} aria-hidden />
      {voice.active && (
        <div className={classes.wave}>
          <VoiceWaveform status={voice.status} muted={voice.muted} getAnalysers={voice.getAnalysers} height={26} bars={12} />
        </div>
      )}
      <div className={classes.caption}>
        <span className={classes.captionMeta}>
          {step && mode && (
            <span className={classes.steps} aria-hidden>
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={`${classes.stepDot} ${i + 1 < step!.index ? classes.stepDone : i + 1 === step!.index ? classes.stepNow : ""}`}
                />
              ))}
            </span>
          )}
          {mode && (voice.active || step) ? `${MODE_LABEL[mode]} · ${meta}` : meta}
          {timeLeft && ` · sisa ${timeLeft}`}
        </span>
        <span
          className={`${classes.captionText} ${
            tone === "warn" ? classes.warn : tone === "error" ? classes.error : tone === "ok" ? classes.ok : ""
          }`}
          title={caption}
        >
          {caption}
        </span>
      </div>
      {voice.active ? (
        <Tooltip label={voice.muted ? "Nyalakan mikrofon" : "Bisukan mikrofon"}>
          <ActionIcon
            variant="subtle"
            color={voice.muted ? "red" : "gray"}
            radius="xl"
            onClick={voice.toggleMute}
            aria-label="Bisukan mikrofon"
          >
            {voice.muted ? <IconMicrophoneOff size={16} /> : <IconMicrophone size={16} />}
          </ActionIcon>
        </Tooltip>
      ) : processing || voice.saving ? (
        <Loader size={14} />
      ) : (
        !busy && (
          <ActionIcon variant="subtle" color="gray" radius="xl" onClick={() => setDismissed(true)} aria-label="Tutup pesan">
            <IconX size={16} />
          </ActionIcon>
        )
      )}
    </div>
  ) : null;

  return (
    <Portal>
      <div
        ref={dockRef}
        className={`${classes.dock} ${anchored ? classes.dockAnchored : classes.dockBottom} ${mode ? classes.dockActive : ""} ${modeClass} ${hiddenClass}`}
        style={position.kind === "anchored" ? { top: position.top, left: position.left } : undefined}
        role="toolbar"
        aria-label="Asisten suara"
        aria-hidden={!visible}
      >
        <div className={classes.controls}>
          <div className={classes.powerWrap}>
            <Tooltip label={mode ? `${MODE_LABEL[mode]} (klik untuk ganti / matikan)` : "Nyalakan asisten suara"} disabled={menuOpen}>
              <button
                type="button"
                // Remounted per mode so the pop-in animation replays on every switch.
                key={mode ?? "off"}
                className={`${classes.power} ${mode ? classes.powerOn : ""}`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={mode ? MODE_LABEL[mode] : "Nyalakan asisten suara"}
                onClick={() => {
                  setHelpOpen(false);
                  setMenuOpen(open => !open);
                }}
              >
                {mode ? (
                  <>
                    <span className={classes.powerIcon}>
                      {mode === "write" ? <IconPencil size={14} stroke={2.2} /> : <IconTerminal2 size={14} stroke={2.2} />}
                    </span>
                    <span className={classes.powerLabel}>{MODE_SHORT[mode]}</span>
                    <span className={`${classes.liveDot} ${voice.active ? classes.liveDotOn : ""}`} aria-hidden />
                  </>
                ) : (
                  <IconMicrophone size={17} stroke={2.1} />
                )}
              </button>
            </Tooltip>

            {menuOpen && (
              <div className={`${classes.menu} ${anchored ? classes.menuDown : classes.menuUp}`} role="menu" aria-label="Pilih mode suara">
                {MODE_OPTIONS.map(option => {
                  const selected = toggle === option.value;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      className={`${classes.option} ${option.className}`}
                      onClick={() => changeToggle(option.value)}
                    >
                      <span className={classes.optionIcon}>
                        <Icon size={16} />
                      </span>
                      <span className={classes.optionText}>
                        <span className={classes.optionTitle}>{option.title}</span>
                        <span className={classes.optionHint}>{option.hint}</span>
                      </span>
                      <span className={classes.optionEnd}>{selected ? <IconCheck size={14} /> : <IconChevronRight size={14} />}</span>
                    </button>
                  );
                })}
                <div className={classes.engineLabel}>Cara memproses suara</div>
                <div className={classes.engineRow} role="group" aria-label="Cara memproses suara">
                  {ENGINE_OPTIONS.map(option => {
                    const Icon = option.icon;
                    return (
                      <Tooltip key={option.value} label={option.hint} withArrow>
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={engine === option.value}
                          disabled={busy || processing}
                          className={classes.engineButton}
                          onClick={() => changeEngine(option.value)}
                        >
                          <Icon size={14} />
                          <span>{option.title}</span>
                        </button>
                      </Tooltip>
                    );
                  })}
                </div>
                {mode && (
                  <button
                    type="button"
                    role="menuitem"
                    className={`${classes.option} ${classes.optOff}`}
                    onClick={() => changeToggle("off")}
                  >
                    <span className={classes.optionIcon}>
                      <IconPower size={16} />
                    </span>
                    <span className={classes.optionText}>
                      <span className={classes.optionTitle}>Matikan</span>
                      <span className={classes.optionHint}>Suara tidak dipakai</span>
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          {mode && (
            <>
              {/* One button: record, then the same button (■) stops. */}
              <Tooltip label={processing ? "Sedang memproses perintah…" : busy ? stopLabel : `Rekam (${MODE_LABEL[mode].toLowerCase()}, ${engine === "batch" ? "rekam dulu" : "realtime"})`}>
                <button
                  type="button"
                  className={`${classes.mic} ${voice.active ? `${classes.micLive} ${classes.micStop}` : ""}`}
                  aria-pressed={voice.active}
                  disabled={processing || voice.finishing}
                  onClick={() => (busy ? voice.stop() : record())}
                  aria-label={busy ? stopLabel : "Mulai rekam"}
                >
                  {voice.status === "connecting" || voice.finishing || processing ? (
                    <Loader size={14} color="white" />
                  ) : voice.active ? (
                    <IconPlayerStopFilled size={15} />
                  ) : (
                    <IconMicrophone size={16} stroke={2.2} />
                  )}
                </button>
              </Tooltip>
              <Tooltip label="Panduan & daftar perintah">
                <ActionIcon
                  variant="default"
                  size={30}
                  radius="xl"
                  className={classes.glassButton}
                  aria-haspopup="dialog"
                  aria-expanded={helpOpen}
                  onClick={() => {
                    setMenuOpen(false);
                    setHelpOpen(true);
                  }}
                  aria-label="Panduan & daftar perintah"
                >
                  <IconQuestionMark size={15} stroke={2.2} />
                </ActionIcon>
              </Tooltip>
            </>
          )}
        </div>

        {anchored ? null : statusPart}
      </div>

      <CommandHelpModal opened={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Next to a paragraph the dock holds only the controls; the status
          (waveform, caption) sits bottom-center so it covers less text. */}
      {anchored && statusPart && (
        <div className={`${classes.dock} ${classes.dockBottom} ${classes.statusAlone} ${mode ? classes.dockActive : ""} ${modeClass} ${hiddenClass}`}>
          {statusPart}
        </div>
      )}
    </Portal>
  );
}

"use client";

import { useEffect, useState } from "react";
import { ActionIcon, Portal, Tooltip } from "@mantine/core";
import { IconMicrophone, IconMicrophoneOff, IconPlayerStopFilled, IconX } from "@tabler/icons-react";
import type { VoiceCommandResult } from "@/components/PlateEditor";
import { useRealtimeVoice } from "@/hooks/useRealtimeVoice";
import VoiceWaveform from "./VoiceWaveform";
import classes from "./VoiceAssistant.module.css";

interface VoiceAssistantProps {
  /** Runs one voice-model function call against the editor. */
  onCommand: (name: string, args: Record<string, unknown>) => Promise<VoiceCommandResult>;
}

/**
 * Realtime voice assistant: a mic button in the editor toolbar, plus a slim
 * floating pill (bottom-center) while a session runs — waveform, one line of
 * what's happening, time left, mute and stop. No panel over the content.
 */
export default function VoiceAssistant({ onCommand }: VoiceAssistantProps) {
  const voice = useRealtimeVoice({ onCommand });
  const [dismissed, setDismissed] = useState(false);

  // A new error/notice after the session ended shows the pill again.
  useEffect(() => {
    if (voice.error || voice.notice) setDismissed(false);
  }, [voice.error, voice.notice]);

  const lastLine = voice.transcript[voice.transcript.length - 1];
  const runningStep = [...voice.transcript].reverse().find(line => line.toolState === "running");

  // One line that says what is happening right now.
  let caption: string;
  let tone: "normal" | "warn" | "error" = "normal";
  if (voice.error) {
    caption = voice.error;
    tone = "error";
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
  } else {
    caption = voice.muted ? "Mikrofon dibisukan" : "Silakan bicara…";
  }

  const meta =
    voice.status === "speaking"
      ? "AI berbicara"
      : voice.status === "working"
        ? "Mengerjakan"
        : voice.active
          ? voice.muted
            ? "Dibisukan"
            : "Mendengarkan"
          : "Asisten suara";
  const timeLeft =
    voice.secondsLeft !== null
      ? `${Math.floor(voice.secondsLeft / 60)}:${String(voice.secondsLeft % 60).padStart(2, "0")}`
      : null;

  const showPill = voice.active || voice.status === "connecting" || ((voice.error || voice.notice) && !dismissed);

  const toggle = () => {
    if (voice.active) {
      voice.stop();
    } else {
      setDismissed(false);
      void voice.start();
    }
  };

  return (
    <>
      <Tooltip label={voice.active ? "Matikan asisten suara" : "Asisten suara"}>
        <ActionIcon
          variant={voice.active ? "filled" : "light"}
          color={voice.active ? "red" : "blue"}
          size="md"
          loading={voice.status === "connecting"}
          onClick={toggle}
          aria-label={voice.active ? "Matikan asisten suara" : "Nyalakan asisten suara"}
        >
          {voice.active ? <IconPlayerStopFilled size={16} /> : <IconMicrophone size={16} />}
        </ActionIcon>
      </Tooltip>

      {showPill && (
        <Portal>
          <div className={classes.pill} role="status" aria-live="polite">
            <div className={`${classes.orb} ${voice.active ? classes.orbActive : ""}`} aria-hidden />
            {voice.active && (
              <div className={classes.wave}>
                <VoiceWaveform status={voice.status} muted={voice.muted} getAnalysers={voice.getAnalysers} height={26} bars={12} />
              </div>
            )}
            <div className={classes.caption}>
              <span className={classes.captionMeta}>
                {meta}
                {timeLeft && ` · sisa ${timeLeft}`}
              </span>
              <span
                className={`${classes.captionText} ${tone === "warn" ? classes.warn : tone === "error" ? classes.error : ""}`}
                title={caption}
              >
                {caption}
              </span>
            </div>
            {voice.active ? (
              <>
                <Tooltip label={voice.muted ? "Nyalakan mikrofon" : "Bisukan mikrofon"}>
                  <ActionIcon variant="subtle" color={voice.muted ? "red" : "gray"} radius="xl" onClick={voice.toggleMute} aria-label="Bisukan mikrofon">
                    {voice.muted ? <IconMicrophoneOff size={16} /> : <IconMicrophone size={16} />}
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Matikan asisten suara">
                  <ActionIcon variant="filled" color="red" radius="xl" onClick={voice.stop} aria-label="Matikan asisten suara">
                    <IconPlayerStopFilled size={14} />
                  </ActionIcon>
                </Tooltip>
              </>
            ) : (
              <ActionIcon variant="subtle" color="gray" radius="xl" onClick={() => setDismissed(true)} aria-label="Tutup">
                <IconX size={16} />
              </ActionIcon>
            )}
          </div>
        </Portal>
      )}
    </>
  );
}

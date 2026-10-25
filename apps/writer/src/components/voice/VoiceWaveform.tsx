"use client";

import { useEffect, useRef } from "react";
import type { VoiceStatus } from "@/hooks/useRealtimeVoice";

interface VoiceWaveformProps {
  status: VoiceStatus;
  muted: boolean;
  getAnalysers: () => { input: AnalyserNode | null; output: AnalyserNode | null };
  height?: number;
  bars?: number;
}

const COLOR_VAR: Record<VoiceStatus, string> = {
  idle: "--mantine-color-gray-5",
  connecting: "--mantine-color-yellow-6",
  listening: "--mantine-color-green-6",
  speaking: "--mantine-color-blue-6",
  working: "--mantine-color-violet-6",
  error: "--mantine-color-red-6",
};

/**
 * Mirrored bar waveform: the mic while listening, the AI's voice while it
 * speaks, and a travelling wave while a command runs.
 */
export default function VoiceWaveform({ status, muted, getAnalysers, height = 56, bars: BARS = 32 }: VoiceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Smoothed bar heights (0..1), eased toward the target every frame.
  const levelsRef = useRef<number[]>([]);
  if (levelsRef.current.length !== BARS) levelsRef.current = new Array(BARS).fill(0);
  const statusRef = useRef(status);
  const mutedRef = useRef(muted);
  statusRef.current = status;
  mutedRef.current = muted;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let raf = 0;
    const bins = new Uint8Array(64);

    const draw = () => {
      frame++;
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const current = statusRef.current;
      const { input, output } = getAnalysers();
      const analyser = current === "speaking" ? output : current === "listening" && !mutedRef.current ? input : null;
      if (analyser) analyser.getByteFrequencyData(bins);

      const t = frame / 60;
      const levels = levelsRef.current;
      for (let i = 0; i < BARS; i++) {
        // Spread the voice-heavy low bins across the bars, symmetric around the middle.
        const fromCenter = Math.abs(i - (BARS - 1) / 2) / (BARS / 2);
        let target: number;
        if (analyser) {
          const bin = Math.min(bins.length - 1, Math.floor(fromCenter * 24) + 1);
          target = Math.pow(bins[bin] / 255, 1.4) * (1 - fromCenter * 0.35);
        } else if (current === "working") {
          target = 0.25 + 0.2 * Math.sin(t * 5 - i * 0.45);
        } else if (current === "connecting") {
          target = 0.12 + 0.1 * Math.sin(t * 3);
        } else {
          target = 0.04;
        }
        levels[i] += (target - levels[i]) * 0.25;
      }

      const color =
        getComputedStyle(canvas).getPropertyValue(COLOR_VAR[current]).trim() || "#228be6";
      const gap = BARS > 20 ? 3 : 2;
      const barWidth = Math.max(2, (width - gap * (BARS - 1)) / BARS);
      const mid = height / 2;
      ctx.fillStyle = color;
      for (let i = 0; i < BARS; i++) {
        const barHeight = Math.max(3, levels[i] * (height - 6));
        const x = i * (barWidth + gap);
        ctx.globalAlpha = 0.45 + 0.55 * Math.min(1, levels[i] * 2.5);
        ctx.beginPath();
        ctx.roundRect(x, mid - barHeight / 2, barWidth, barHeight, barWidth / 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [getAnalysers, height, BARS]);

  return <canvas ref={canvasRef} style={{ width: "100%", height, display: "block" }} aria-hidden />;
}

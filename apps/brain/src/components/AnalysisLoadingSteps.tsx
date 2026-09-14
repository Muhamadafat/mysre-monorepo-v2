// src/components/AnalysisLoadingSteps.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { LoadingStep } from '@/types';

interface AnalysisLoadingStepsProps {
  steps: LoadingStep[];
  tabLabel?: string;
  isDark?: boolean;
  onRetry?: () => void;
  hasError?: boolean;
}

// ── Komponen Jam/Timer per step ────────────────────────────────────────────────
function StepTimer({
  running,
  estimateSec,
}: {
  running: boolean;
  estimateSec?: number;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      500
    );
    return () => clearInterval(id);
  }, [running]);

  if (!running) return null;
  return (
    <span
      style={{
        fontSize: 11,
        color: '#6366f1',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {estimateSec && (
        <span style={{ color: 'inherit', opacity: 0.75 }}>
          Estimasi: ~{estimateSec}d •
        </span>
      )}
      {elapsed}d
    </span>
  );
}

// ── Status Icon ────────────────────────────────────────────────────────────────
function StepIcon({
  status,
  index,
}: {
  status: LoadingStep['status'];
  index: number;
}) {
  const size = 36;
  const common: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
  };

  if (status === 'done') {
    return (
      <div
        style={{
          ...common,
          backgroundColor: 'rgba(34,197,94,0.15)',
          border: '2px solid #22c55e',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M3 8l3.5 3.5L13 5"
            stroke="#22c55e"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        style={{
          ...common,
          backgroundColor: 'rgba(239,68,68,0.15)',
          border: '2px solid #ef4444',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M2 2l10 10M12 2L2 12"
            stroke="#ef4444"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  if (status === 'running') {
    return (
      <div style={{ ...common, position: 'relative' }}>
        {/* Outer rotating ring */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '2.5px solid transparent',
            borderTopColor: '#6366f1',
            borderRightColor: '#6366f180',
            animation: 'ls-spin 0.9s linear infinite',
          }}
        />
        {/* Inner dot */}
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: 'rgba(99,102,241,0.25)',
            border: '2px solid #6366f1',
            animation: 'ls-pulse 1.4s ease-in-out infinite',
          }}
        />
      </div>
    );
  }

  // waiting
  return (
    <div
      style={{
        ...common,
        backgroundColor: 'rgba(148,163,184,0.08)',
        border: '2px solid rgba(148,163,184,0.25)',
        fontSize: 13,
        fontWeight: 700,
        color: 'rgba(148,163,184,0.6)',
      }}
    >
      {index + 1}
    </div>
  );
}

// ── Status Badge ───────────────────────────────────────────────────────────────
function StatusBadge({
  status,
  durationMs,
}: {
  status: LoadingStep['status'];
  durationMs?: number;
}) {
  const cfg: Record<
    LoadingStep['status'],
    { label: string; bg: string; color: string }
  > = {
    waiting: {
      label: 'Menunggu',
      bg: 'rgba(148,163,184,0.12)',
      color: '#64748b',
    },
    running: {
      label: 'Sedang Berjalan',
      bg: 'rgba(99,102,241,0.12)',
      color: '#6366f1',
    },
    done: { label: 'Selesai', bg: 'rgba(34,197,94,0.12)', color: '#16a34a' },
    error: { label: 'Gagal', bg: 'rgba(239,68,68,0.12)', color: '#dc2626' },
  };
  const c = cfg[status];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 99,
          backgroundColor: c.bg,
          color: c.color,
          letterSpacing: '0.04em',
        }}
      >
        {c.label}
      </span>
      {status === 'done' && durationMs !== undefined && (
        <span style={{ fontSize: 10, color: '#64748b', fontWeight: 500 }}>
          {(durationMs / 1000).toFixed(1)} detik
        </span>
      )}
      {status === 'waiting' && (
        <span style={{ fontSize: 10, color: '#94a3b8' }}>—</span>
      )}
    </div>
  );
}

// ── Connector Line ─────────────────────────────────────────────────────────────
function Connector({ done }: { done: boolean }) {
  return (
    <div
      style={{
        width: 2,
        height: 24,
        marginLeft: 17,
        backgroundColor: done ? '#22c55e' : 'rgba(148,163,184,0.2)',
        borderRadius: 2,
        transition: 'background-color 0.4s ease',
      }}
    />
  );
}

// ── Main Component ──────────────────────────────────────────────────────────────
export default function AnalysisLoadingSteps({
  steps,
  tabLabel,
  isDark = false,
  onRetry,
  hasError = false,
}: AnalysisLoadingStepsProps) {
  const bg = isDark ? '#0d0f18' : '#ffffff';
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc';
  const cardBorder = isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0';
  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textDim = isDark ? '#94a3b8' : '#64748b';

  const allDone = steps.every((s) => s.status === 'done');
  const anyError = steps.some((s) => s.status === 'error');

  return (
    <div style={{ backgroundColor: bg, padding: '28px 24px', flex: 1 }}>
      <style>{`
        @keyframes ls-spin  { to { transform: rotate(360deg); } }
        @keyframes ls-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes ls-fade-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* ── Header ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          marginBottom: 28,
          animation: 'ls-fade-in 0.35s ease',
        }}
      >
        {/* AI Sparkle icon */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            flexShrink: 0,
            background:
              'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(20,184,166,0.15))',
            border: `1px solid ${isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.2)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
          }}
        >
          {anyError ? '⚠️' : allDone ? '✅' : '✨'}
        </div>
        <div>
          <p
            style={{
              fontSize: 15,
              fontWeight: 700,
              margin: '0 0 3px',
              color: anyError ? '#ef4444' : allDone ? '#22c55e' : textPrimary,
            }}
          >
            {anyError
              ? 'Terjadi Kesalahan'
              : allDone
                ? 'Analisis Selesai!'
                : 'Sedang Menganalisis Artikel Anda...'}
          </p>
          <p style={{ fontSize: 12, color: textDim, margin: 0 }}>
            {anyError
              ? 'Analisis tidak dapat dilanjutkan.'
              : allDone
                ? 'Hasil analisis siap ditampilkan.'
                : 'Mohon tunggu, proses ini biasanya memakan waktu 15–30 detik.'}
          </p>
        </div>
      </div>

      {/* ── Step List ───────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {steps.map((step, idx) => {
          const isRunning = step.status === 'running';
          const isDone = step.status === 'done';
          const isError = step.status === 'error';
          const isActive = isRunning || isError;

          return (
            <div key={step.id} style={{ animation: 'ls-fade-in 0.3s ease' }}>
              {/* Step card */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                }}
              >
                <StepIcon status={step.status} index={idx} />

                <div
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: `1px solid ${
                      isRunning
                        ? 'rgba(99,102,241,0.3)'
                        : isError
                          ? 'rgba(239,68,68,0.3)'
                          : isDone
                            ? 'rgba(34,197,94,0.2)'
                            : cardBorder
                    }`,
                    backgroundColor: isRunning
                      ? isDark
                        ? 'rgba(99,102,241,0.07)'
                        : 'rgba(99,102,241,0.04)'
                      : isError
                        ? isDark
                          ? 'rgba(239,68,68,0.07)'
                          : 'rgba(239,68,68,0.03)'
                        : isDone
                          ? isDark
                            ? 'rgba(34,197,94,0.05)'
                            : 'rgba(34,197,94,0.03)'
                          : cardBg,
                    transition: 'all 0.3s ease',
                    boxShadow: isActive
                      ? isDark
                        ? `0 0 0 1px ${isError ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.12)'}`
                        : `0 2px 12px ${isError ? 'rgba(239,68,68,0.08)' : 'rgba(99,102,241,0.08)'}`
                      : 'none',
                  }}
                >
                  {/* Row 1: label + badge */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: isRunning ? 6 : 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: isActive || isDone ? 700 : 500,
                        color: isRunning
                          ? isDark
                            ? '#a5b4fc'
                            : '#4338ca'
                          : isError
                            ? isDark
                              ? '#fca5a5'
                              : '#dc2626'
                            : isDone
                              ? isDark
                                ? '#86efac'
                                : '#15803d'
                              : textDim,
                        lineHeight: 1.3,
                      }}
                    >
                      {step.label}
                    </span>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flexShrink: 0,
                      }}
                    >
                      <StatusBadge
                        status={step.status}
                        durationMs={step.durationMs}
                      />
                      {isRunning && (
                        <StepTimer
                          running={true}
                          estimateSec={step.estimateSec}
                        />
                      )}
                    </div>
                  </div>

                  {/* Row 2: description */}
                  <p
                    style={{
                      fontSize: 11,
                      color: textDim,
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    {isError && step.errorMsg
                      ? step.errorMsg
                      : step.description}
                  </p>
                </div>
              </div>

              {/* Connector between steps */}
              {idx < steps.length - 1 && <Connector done={isDone} />}
            </div>
          );
        })}
      </div>

      {/* ── Info bar (hanya saat loading) ────────────────── */}
      {!anyError && !allDone && (
        <div
          style={{
            marginTop: 20,
            padding: '10px 14px',
            borderRadius: 8,
            backgroundColor: isDark
              ? 'rgba(99,102,241,0.06)'
              : 'rgba(99,102,241,0.04)',
            border: `1px solid ${isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation: 'ls-fade-in 0.4s ease',
          }}
        >
          <span style={{ fontSize: 14, flexShrink: 0 }}>ℹ️</span>
          <p
            style={{
              fontSize: 11,
              color: isDark ? '#a5b4fc' : '#6366f1',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Halaman ini akan otomatis berpindah ke hasil analisis setelah proses
            selesai.
          </p>
        </div>
      )}

      {/* ── Retry button (saat error) ─────────────────────── */}
      {anyError && onRetry && (
        <div
          style={{
            marginTop: 20,
            padding: '10px 14px',
            borderRadius: 8,
            backgroundColor: isDark
              ? 'rgba(239,68,68,0.06)'
              : 'rgba(239,68,68,0.04)',
            border: `1px solid ${isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.12)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 14, flexShrink: 0 }}>🔴</span>
          <p
            style={{
              fontSize: 11,
              color: isDark ? '#fca5a5' : '#dc2626',
              margin: 0,
              flex: 1,
              lineHeight: 1.5,
            }}
          >
            {steps.find((s) => s.status === 'error')?.id === 'fetch'
              ? 'Gagal mengambil data artikel dari database.'
              : 'AI gagal memproses request analisis. Silakan coba lagi atau kurangi jumlah aspek yang dipilih.'}
          </p>
          <button
            onClick={onRetry}
            style={{
              padding: '7px 14px',
              borderRadius: 7,
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#fff',
              border: 'none',
              fontSize: 12,
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(239,68,68,0.3)',
              flexShrink: 0,
            }}
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* ── Legend (Keterangan Status) ────────────────────── */}
      <div
        style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}`,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: textDim,
            letterSpacing: '0.06em',
          }}
        >
          KETERANGAN STATUS
        </span>
        {[
          { icon: '○', label: 'Menunggu', color: '#94a3b8' },
          { icon: '◌', label: 'Sedang Berjalan', color: '#6366f1' },
          { icon: '✓', label: 'Selesai', color: '#22c55e' },
          { icon: '×', label: 'Gagal', color: '#ef4444' },
        ].map(({ icon, label, color }) => (
          <div
            key={label}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <span style={{ fontSize: 13, color, fontWeight: 700 }}>{icon}</span>
            <span style={{ fontSize: 10, color: textDim }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

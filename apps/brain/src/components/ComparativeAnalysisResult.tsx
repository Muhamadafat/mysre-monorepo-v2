/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  IconRefresh,
  IconChevronUp,
  IconChevronDown,
  IconPlus,
  IconCheck,
} from '@tabler/icons-react';
import { ComparativeAnalysisData, LoadingStep } from '@/types';
import AnalysisLoadingSteps from '@/components/AnalysisLoadingSteps';
import { Text, Group, ActionIcon, Stack, Progress } from '@mantine/core';

// ── Aspect label map ──────────────────────────────────────────────
const ASPECT_LABELS: Record<string, { label: string; color: string }> = {
  background: { label: 'Latar Belakang', color: '#6366f1' },
  goal: { label: 'Tujuan Penelitian', color: '#14b8a6' },
  method: { label: 'Metodologi', color: '#3b82f6' },
  gap: { label: 'Gap Penelitian', color: '#f59e0b' },
  future: { label: 'Arahan Masa Depan', color: '#ec4899' },
};

// ── Article palette ──────────────────────────────────────────────
const ARTICLE_PALETTE = [
  { primary: '#6366f1', soft: 'rgba(99,102,241,0.10)', badge: '#6366f1' },
  { primary: '#14b8a6', soft: 'rgba(20,184,166,0.10)', badge: '#0d9488' },
  { primary: '#f59e0b', soft: 'rgba(245,158,11,0.10)', badge: '#d97706' },
  { primary: '#ef4444', soft: 'rgba(239,68,68,0.10)', badge: '#dc2626' },
  { primary: '#8b5cf6', soft: 'rgba(139,92,246,0.10)', badge: '#7c3aed' },
  { primary: '#ec4899', soft: 'rgba(236,72,153,0.10)', badge: '#db2777' },
];
const ARTICLE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

// ── Skeleton ──────────────────────────────────────────────────────
function SkeletonLine({
  width = '100%',
  height = 13,
}: {
  width?: string;
  height?: number;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 5,
        backgroundColor: 'rgba(148,163,184,0.12)',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  );
}
function SkeletonSection() {
  return (
    <div
      style={{
        marginBottom: 16,
        borderRadius: 12,
        border: '1px solid rgba(148,163,184,0.1)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '14px 18px',
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          borderBottom: '1px solid rgba(148,163,184,0.08)',
        }}
      >
        <SkeletonLine width="28px" height={28} />
        <SkeletonLine width="140px" height={14} />
      </div>
      <div
        style={{
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 9,
        }}
      >
        <SkeletonLine width="100%" />
        <SkeletonLine width="92%" />
        <SkeletonLine width="78%" />
      </div>
    </div>
  );
}

// ── Collapsible Section Card ──────────────────────────────────────
interface SectionCardProps {
  index: number;
  title: string;
  icon: string;
  accentColor: string;
  isDark: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}
function SectionCard({
  index,
  title,
  icon,
  accentColor,
  isDark,
  defaultOpen = false,
  children,
}: SectionCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const borderColor = isDark ? 'rgba(255,255,255,0.07)' : '#e5e7eb';
  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${borderColor}`,
        overflow: 'hidden',
        marginBottom: 14,
        transition: 'box-shadow 0.2s',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '13px 18px',
          cursor: 'pointer',
          border: 'none',
          textAlign: 'left',
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
          borderBottom: open ? `1px solid ${borderColor}` : 'none',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = isDark
            ? 'rgba(255,255,255,0.055)'
            : '#f1f5f9';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = isDark
            ? 'rgba(255,255,255,0.03)'
            : '#f8fafc';
        }}
      >
        {/* Number badge */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${accentColor}20`,
            fontSize: 11,
            fontWeight: 800,
            color: accentColor,
          }}
        >
          {index}
        </div>
        {/* Icon */}
        <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
        {/* Title */}
        <span
          style={{
            flex: 1,
            fontSize: 14,
            fontWeight: 700,
            color: accentColor,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </span>
        {/* Chevron */}
        <span style={{ color: isDark ? '#475569' : '#94a3b8', flexShrink: 0 }}>
          {open ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
        </span>
      </button>
      {/* Body */}
      {open && (
        <div
          style={{
            padding: '18px 20px',
            backgroundColor: isDark ? 'rgba(255,255,255,0.015)' : '#ffffff',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────
interface ComparativeAnalysisResultProps {
  data?: ComparativeAnalysisData | null;
  loading?: boolean;
  loadingSteps?: LoadingStep[];
  error?: string | null;
  onRetry?: () => void;
  isDark?: boolean;
  aspects?: string[]; // aspek yang dipilih user (untuk badge)
  articleTitles?: string[]; // judul artikel yang dibandingkan
  createdAt?: number; // timestamp untuk footer
  // ── Fitur Simpan ke Catatan (Step 9–10) ──
  onSaveNote?: (
    text: string,
    customLabel?: string,
    articleId?: string,
    comment?: string
  ) => Promise<void> | void;
  caTabLabel?: string; // label tab sebagai sumber catatan
  globalHighlights?: string[]; // Catatan/highlights global dari parent
}

// ── Main Component ────────────────────────────────────────────────
export default function ComparativeAnalysisResult({
  data,
  loading = false,
  loadingSteps,
  error = null,
  onRetry,
  isDark = false,
  aspects = [],
  articleTitles = [],
  createdAt,
  onSaveNote,
  caTabLabel = 'Analisis Komparatif',
  globalHighlights = [],
}: ComparativeAnalysisResultProps) {
  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? 'rgba(255,255,255,0.07)' : '#e5e7eb';

  // ── Floating Save Button State ───────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [floatBtn, setFloatBtn] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [noteComment, setNoteComment] = useState('');
  const [articlePage, setArticlePage] = useState(0);

  const params = useParams();
  const projectId = params?.id as string;

  // Deteksi text selection di dalam container hasil analisis
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!onSaveNote) return;

      // Jangan proses jika klik terjadi di dalam popup itu sendiri
      const popup = document.getElementById('ca-save-note-container');
      if (popup && popup.contains(e.target as Node)) {
        return;
      }

      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (!text || text.length < 5) {
        setFloatBtn(null);
        setNoteComment('');
        return;
      }
      if (!containerRef.current) return;
      const range = selection?.getRangeAt(0);
      if (!range) return;
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      if (!containerRef.current.contains(range.commonAncestorContainer)) {
        setFloatBtn(null);
        setNoteComment('');
        return;
      }
      setFloatBtn({
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top - 70,
        text,
      });
      setSaved(false);
      setNoteComment('');
    },
    [onSaveNote]
  );

  // Tutup button saat klik di luar
  useEffect(() => {
    const hide = (e: MouseEvent) => {
      const btn = document.getElementById('ca-save-note-container');
      if (btn && btn.contains(e.target as Node)) return;
      setFloatBtn(null);
    };
    document.addEventListener('mousedown', hide);
    return () => document.removeEventListener('mousedown', hide);
  }, []);

  const handleSaveNote = async () => {
    if (!floatBtn || !onSaveNote) return;
    setSaving(true);
    try {
      await (onSaveNote as any)(
        floatBtn.text,
        caTabLabel,
        undefined,
        noteComment
      );
      setSaved(true);
      setTimeout(() => {
        setFloatBtn(null);
        setSaved(false);
        setNoteComment('');
        window.getSelection()?.removeAllRanges();
      }, 1200);
    } finally {
      setSaving(false);
    }
  };

  // Helper untuk merender teks dengan highlight permanen yang robust terhadap spasi & newline
  const renderTextWithHighlights = (text: string) => {
    const activeHighlights = [...globalHighlights];
    if (floatBtn?.text && !activeHighlights.includes(floatBtn.text)) {
      activeHighlights.push(floatBtn.text);
    }

    if (activeHighlights.length === 0) return text;

    const sortedHighlights = activeHighlights.sort(
      (a, b) => b.length - a.length
    );
    let result: React.ReactNode[] = [text];

    sortedHighlights.forEach((highlight) => {
      if (!highlight.trim()) return;

      const newResult: React.ReactNode[] = [];
      const isSaved = globalHighlights.includes(highlight);

      // Escape special regex characters
      const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Normalize whitespace matching: any whitespace/newlines in highlight matches any whitespace/newlines in text
      const regexPattern = escapedHighlight.replace(/\s+/g, '\\s+');
      const normalizedHighlight = highlight.toLowerCase().replace(/\s+/g, '');

      try {
        const regex = new RegExp(`(${regexPattern})`, 'gi');

        result.forEach((part) => {
          if (typeof part === 'string') {
            const pieces = part.split(regex);
            pieces.forEach((piece, i) => {
              if (!piece) return;

              const normalizedPiece = piece.toLowerCase().replace(/\s+/g, '');
              if (normalizedPiece === normalizedHighlight) {
                newResult.push(
                  <mark
                    key={`${highlight}-${i}-${Math.random()}`}
                    style={{
                      backgroundColor: 'rgba(255, 255, 0, 0.95)',
                      color: '#000',
                      borderRadius: '3px',
                      padding: '0 2px',
                      boxShadow: isSaved
                        ? '0 0 12px rgba(255, 255, 0, 0.7)'
                        : '0 0 8px rgba(255, 255, 0, 0.4)',
                      fontWeight: 700,
                      display: 'inline',
                      cursor: 'help',
                      WebkitPrintColorAdjust: 'exact',
                    }}
                    title={
                      isSaved ? 'Catatan tersimpan' : "Tekan '+' untuk simpan"
                    }
                  >
                    {piece}
                  </mark>
                );
              } else {
                newResult.push(piece);
              }
            });
          } else {
            newResult.push(part);
          }
        });
        result = newResult;
      } catch (e) {
        // Fallback to exact match if regex fails
        const fallbackResult: React.ReactNode[] = [];
        result.forEach((part) => {
          if (typeof part === 'string') {
            const pieces = part.split(highlight);
            pieces.forEach((piece, i) => {
              fallbackResult.push(piece);
              if (i < pieces.length - 1) {
                fallbackResult.push(
                  <mark
                    key={`${highlight}-${i}`}
                    style={{
                      backgroundColor: 'rgba(255, 255, 0, 0.95)',
                      color: '#000',
                      borderRadius: '3px',
                      padding: '0 2px',
                      boxShadow: isSaved
                        ? '0 0 12px rgba(255, 255, 0, 0.7)'
                        : '0 0 8px rgba(255, 255, 0, 0.4)',
                      fontWeight: 700,
                      display: 'inline',
                      cursor: 'help',
                    }}
                    title={
                      isSaved ? 'Catatan tersimpan' : "Tekan '+' untuk simpan"
                    }
                  >
                    {highlight}
                  </mark>
                );
              }
            });
          } else {
            fallbackResult.push(part);
          }
        });
        result = fallbackResult;
      }
    });

    return <>{result}</>;
  };

  // Timestamp footer
  const dateStr = createdAt
    ? new Date(createdAt).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

  // Pagination aman
  const maxPage = Math.max(0, Math.ceil(articleTitles.length / 4) - 1);
  const safeArticlePage = Math.min(articlePage, maxPage);

  // ── Helpers ──────────────────────────────────────────────────
  const bulletStyle: React.CSSProperties = {
    margin: 0,
    paddingLeft: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  };
  const liStyle: React.CSSProperties = {
    fontSize: 13,
    lineHeight: 1.7,
    color: isDark ? '#cbd5e1' : '#374151',
  };
  const paraStyle: React.CSSProperties = {
    fontSize: 13,
    lineHeight: 1.75,
    color: isDark ? '#cbd5e1' : '#374151',
    margin: 0,
    whiteSpace: 'pre-wrap',
  };

  const getAspectBadge = (aspectName?: string) => {
    const safeName = aspectName || 'Umum';
    // try to find matching color
    const key =
      Object.keys(ASPECT_LABELS).find(
        (k) => ASPECT_LABELS[k].label.toLowerCase() === safeName.toLowerCase()
      ) || safeName;
    const info = ASPECT_LABELS[key] || { label: safeName, color: '#3b82f6' };
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '3px 10px',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 600,
          backgroundColor: `${info.color}20`,
          color: info.color,
          border: `1px solid ${info.color}30`,
          whiteSpace: 'nowrap',
          marginBottom: '8px',
        }}
      >
        {safeName}
      </span>
    );
  };

  const getUnifiedCritiqueBadge = (aspectName: string, docTitle: string) => {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: isDark
            ? 'rgba(245,158,11,0.05)'
            : 'rgba(245,158,11,0.08)',
          border: `1px solid ${isDark ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.3)'}`,
          borderRadius: '8px',
          overflow: 'hidden',
          marginBottom: '12px',
          width: 'fit-content',
          maxWidth: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            padding: '4px 10px',
            borderBottom: `1px solid ${isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.2)'}`,
            gap: '8px',
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: textSecondary,
              textTransform: 'uppercase',
              minWidth: '50px',
            }}
          >
            Aspek
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: isDark ? '#fbbf24' : '#b45309',
            }}
          >
            {aspectName}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            padding: '4px 10px',
            gap: '8px',
            backgroundColor: isDark
              ? 'rgba(245,158,11,0.1)'
              : 'rgba(245,158,11,0.15)',
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: textSecondary,
              textTransform: 'uppercase',
              minWidth: '50px',
            }}
          >
            Artikel
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: isDark ? '#fbbf24' : '#b45309',
              wordBreak: 'break-word',
            }}
          >
            {docTitle}
          </span>
        </div>
      </div>
    );
  };

  const renderEvidenceList = (buktiList: any[], colorHex: string) => {
    if (!buktiList || !Array.isArray(buktiList) || buktiList.length === 0)
      return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {buktiList.map((ev, idx) => (
          <div
            key={idx}
            style={{
              padding: '10px 14px',
              backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : `${colorHex}15`,
              borderRadius: '8px',
              borderLeft: `3px solid ${colorHex}`,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: textSecondary,
                textTransform: 'uppercase',
                marginBottom: 4,
                letterSpacing: '0.05em',
              }}
            >
              Bukti: {ev.sumber_dokumen || `Dokumen ${idx + 1}`}
            </div>
            <blockquote
              style={{
                ...paraStyle,
                margin: 0,
                fontStyle: 'italic',
                color: textSecondary,
              }}
            >
              "{renderTextWithHighlights(ev.kutipan_verbatim || '')}"
            </blockquote>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      style={{ width: '100%', color: textPrimary, position: 'relative' }}
    >
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } } 
        @keyframes ca-fadein { from { opacity: 0; transform: translateX(-50%) translateY(4px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        
        /* WARNA SELEKSI (STABILO) GLOBAL SAAT USER MENYERET MOUSE */
        .ca-content-root ::selection {
          background-color: rgba(255, 255, 0, 0.9) !important;
          color: #000 !important;
        }

        .ca-table-wrapper::-webkit-scrollbar {
          height: 6px;
        }
        .ca-table-wrapper::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.4);
          border-radius: 3px;
        }
      `}</style>
      <div className="ca-content-root">
        {/* ══ FLOATING: Keterangan Catatan Tooltip ═══════════════════ */}
        {floatBtn && onSaveNote && (
          <div
            id="ca-save-note-container"
            style={{
              position: 'absolute',
              left: Math.max(
                120,
                Math.min(
                  floatBtn.x,
                  (containerRef.current?.offsetWidth ?? 400) - 120
                )
              ),
              top: Math.max(4, floatBtn.y),
              transform: 'translateX(-50%)',
              zIndex: 100,
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              border: `2px solid ${isDark ? 'rgba(255,255,0,0.3)' : 'rgba(255,255,0,0.5)'}`,
              boxShadow:
                '0 15px 35px rgba(0,0,0,0.3), 0 0 15px rgba(255,255,0,0.2)',
              minWidth: '260px',
              animation: 'ca-fadein 0.18s ease',
            }}
          >
            <Stack gap={8}>
              <Group justify="space-between" align="center">
                <Text
                  size="xs"
                  fw={900}
                  style={{
                    letterSpacing: '0.05em',
                    color: '#eab308',
                    textTransform: 'uppercase',
                  }}
                >
                  Simpan Sebagai Catatan
                </Text>
                {!saved && (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: '#eab308',
                      animation: 'pulse 1s infinite',
                    }}
                  />
                )}
              </Group>

              <Group gap={6} align="flex-end">
                <input
                  type="text"
                  autoFocus
                  placeholder="Ketik keterangan (mis: 'Penting')..."
                  value={noteComment}
                  onChange={(e) => setNoteComment(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                    color: isDark ? '#f8fafc' : '#0f172a',
                    fontSize: '12px',
                    outline: 'none',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !saving && !saved) {
                      handleSaveNote();
                    }
                  }}
                />
                <ActionIcon
                  color={saved ? 'green' : 'yellow'}
                  variant="filled"
                  size="lg"
                  loading={saving}
                  onClick={handleSaveNote}
                  disabled={saved}
                  style={{
                    backgroundColor: saved ? undefined : '#eab308',
                    boxShadow: saved
                      ? 'none'
                      : '0 4px 12px rgba(234, 179, 8, 0.3)',
                  }}
                >
                  {saved ? <IconCheck size={18} /> : <IconPlus size={18} />}
                </ActionIcon>
              </Group>
              {saved && (
                <Text size="10px" fw={700} c="green" ta="center">
                  ✅ Berhasil disimpan ke Catatan!
                </Text>
              )}
            </Stack>
          </div>
        )}

        {/* ══ HEADER: Aspek badge bar ══════════════════════════════ */}
        {aspects.length > 0 && (
          <div
            style={{
              padding: '12px 20px 0',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: textSecondary,
                fontWeight: 600,
                marginRight: 2,
              }}
            >
              Aspek yang dianalisis:
            </span>
            {aspects.map((a) => {
              const info = ASPECT_LABELS[a] || { label: a, color: '#64748b' };
              return (
                <span
                  key={a}
                  style={{
                    padding: '2px 10px',
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: `${info.color}18`,
                    color: info.color,
                    border: `1px solid ${info.color}30`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {info.label}
                </span>
              );
            })}
          </div>
        )}

        {/* ══ DAFTAR LITERATUR ════════════════════════════════════ */}
        {articleTitles.length > 0 && (
          <div style={{ padding: '16px 20px 0' }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: textSecondary,
                marginBottom: 16,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
                </svg>
                LITERATUR YANG DIANALISIS
              </div>
              {articleTitles.length > 4 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    disabled={safeArticlePage === 0}
                    onClick={() => setArticlePage((p) => Math.max(0, p - 1))}
                    style={{ borderRadius: 6 }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                  </ActionIcon>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      margin: '0 4px',
                      color: textSecondary,
                    }}
                  >
                    {safeArticlePage + 1} / {maxPage + 1}
                  </span>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    disabled={safeArticlePage >= maxPage}
                    onClick={() =>
                      setArticlePage((p) => Math.min(maxPage, p + 1))
                    }
                    style={{ borderRadius: 6 }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </ActionIcon>
                </div>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'nowrap',
                justifyContent: 'flex-start',
                alignItems: 'center',
                gap: '8px',
                overflow: 'visible',
                paddingTop: '12px',
                width: '100%',
              }}
            >
              {articleTitles
                .slice(safeArticlePage * 4, safeArticlePage * 4 + 4)
                .map((title, sliceIdx) => {
                  const idx = safeArticlePage * 4 + sliceIdx;
                  const pal = ARTICLE_PALETTE[idx % ARTICLE_PALETTE.length];
                  return (
                    <div
                      key={idx}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '2px 8px',
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.02)'
                          : 'rgba(0, 0, 0, 0.02)',
                        borderRadius: '10px',
                        border: `1px solid ${pal.primary}35`,
                        maxWidth: '180px',
                        minWidth: '0px',
                        height: '32px',
                        flex: '0 1 180px',
                      }}
                    >
                      {/* Badge */}
                      <div
                        style={{
                          position: 'absolute',
                          top: -8,
                          left: 8,
                          backgroundColor: pal.primary,
                          color: '#fff',
                          fontSize: 7,
                          fontWeight: 900,
                          padding: '1px 5px',
                          borderRadius: 6,
                          letterSpacing: '0.02em',
                          zIndex: 1,
                        }}
                      >
                        FILE {ARTICLE_LABELS[idx]}
                      </div>

                      {/* Icon */}
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 5,
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.05)'
                            : 'rgba(0,0,0,0.04)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: pal.primary,
                          flexShrink: 0,
                        }}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                      </div>

                      {/* Title */}
                      <span
                        style={{
                          fontSize: 10,
                          lineHeight: 1.2,
                          color: textPrimary,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flex: 1,
                        }}
                      >
                        {title}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {loading ? (
          loadingSteps && loadingSteps.length > 0 ? (
            <AnalysisLoadingSteps
              steps={loadingSteps}
              isDark={isDark}
              onRetry={onRetry}
              hasError={loadingSteps.some((s) => s.status === 'error')}
            />
          ) : (
            <div style={{ padding: '24px 20px' }}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <SkeletonSection key={i} />
              ))}
            </div>
          )
        ) : error || data?.error ? (
          <div
            style={{
              padding: '24px 20px',
              margin: '16px',
              borderRadius: 12,
              backgroundColor: isDark
                ? 'rgba(239,68,68,0.08)'
                : 'rgba(239,68,68,0.04)',
              border: `1px solid ${isDark ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.2)'}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: 24 }}>⚠️</span>
            <p
              style={{
                fontSize: 13,
                color: isDark ? '#fca5a5' : '#dc2626',
                margin: 0,
                fontWeight: 700,
              }}
            >
              Gagal menghasilkan analisis
            </p>
            <p
              style={{
                fontSize: 12,
                color: textSecondary,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {error || data?.error || 'Terjadi kesalahan'}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 18px',
                  borderRadius: 8,
                  background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <IconRefresh size={14} /> Coba Lagi
              </button>
            )}
          </div>
        ) : data ? (
          <>
            {/* ══ SECTIONS ════════════════════════════════════════════ */}
            <div style={{ padding: '14px 20px 20px' }}>
              {/* 1. Konvergensi (Temuan Bersama) */}
              <SectionCard
                index={1}
                title="Konvergensi (Temuan Bersama)"
                icon="🔗"
                accentColor="#10b981"
                isDark={isDark}
                defaultOpen={false}
              >
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                >
                  {data.konvergensi &&
                    data.konvergensi.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '16px',
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.02)'
                            : '#f8fafc',
                          borderRadius: '12px',
                          border: `1px solid ${borderColor}`,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        }}
                      >
                        <div
                          style={{
                            marginBottom: '12px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          {getAspectBadge(
                            item.aspek_analisis || item.aspek_konteks
                          )}
                        </div>
                        <p
                          style={{
                            ...paraStyle,
                            marginBottom: '12px',
                            color: textPrimary,
                            fontWeight: 500,
                          }}
                        >
                          {renderTextWithHighlights(
                            item.argumen_utama || item.argumen_objektif || ''
                          )}
                        </p>
                        {item.bukti &&
                        Array.isArray(item.bukti) &&
                        item.bukti.length > 0 ? (
                          renderEvidenceList(item.bukti, '#10b981')
                        ) : (
                          <div
                            style={{
                              padding: '10px 14px',
                              backgroundColor: isDark
                                ? 'rgba(0,0,0,0.2)'
                                : 'rgba(16,185,129,0.08)',
                              borderRadius: '8px',
                              borderLeft: '3px solid #10b981',
                            }}
                          >
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: textSecondary,
                                textTransform: 'uppercase',
                                marginBottom: 4,
                                letterSpacing: '0.05em',
                              }}
                            >
                              Kutipan Bukti
                            </div>
                            <blockquote
                              style={{
                                ...paraStyle,
                                margin: 0,
                                fontStyle: 'italic',
                                color: textSecondary,
                              }}
                            >
                              "
                              {renderTextWithHighlights(
                                item.bukti_dokumen || ''
                              )}
                              "
                            </blockquote>
                          </div>
                        )}
                      </div>
                    ))}
                  {(!data.konvergensi || data.konvergensi.length === 0) && (
                    <p
                      style={{
                        ...paraStyle,
                        color: textSecondary,
                        fontStyle: 'italic',
                      }}
                    >
                      Tidak ada titik temu konvergensi ditemukan.
                    </p>
                  )}
                </div>
              </SectionCard>

              {/* 2. Divergensi (Perbedaan Utama) */}
              <SectionCard
                index={2}
                title="Divergensi (Perbedaan Utama)"
                icon="↔️"
                accentColor="#3b82f6"
                isDark={isDark}
                defaultOpen={false}
              >
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                >
                  {data.divergensi &&
                    data.divergensi.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '16px',
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.02)'
                            : '#f8fafc',
                          borderRadius: '12px',
                          border: `1px solid ${borderColor}`,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        }}
                      >
                        <div
                          style={{
                            marginBottom: '12px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          {getAspectBadge(
                            item.aspek_analisis || item.aspek_konteks
                          )}
                        </div>
                        <p
                          style={{
                            ...paraStyle,
                            marginBottom: '12px',
                            color: textPrimary,
                            fontWeight: 500,
                          }}
                        >
                          {renderTextWithHighlights(
                            item.argumen_utama || item.argumen_objektif || ''
                          )}
                        </p>
                        {item.bukti &&
                        Array.isArray(item.bukti) &&
                        item.bukti.length > 0 ? (
                          renderEvidenceList(item.bukti, '#3b82f6')
                        ) : (
                          <div
                            style={{
                              padding: '10px 14px',
                              backgroundColor: isDark
                                ? 'rgba(0,0,0,0.2)'
                                : 'rgba(59,130,246,0.08)',
                              borderRadius: '8px',
                              borderLeft: '3px solid #3b82f6',
                            }}
                          >
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: textSecondary,
                                textTransform: 'uppercase',
                                marginBottom: 4,
                                letterSpacing: '0.05em',
                              }}
                            >
                              Kutipan Bukti
                            </div>
                            <blockquote
                              style={{
                                ...paraStyle,
                                margin: 0,
                                fontStyle: 'italic',
                                color: textSecondary,
                              }}
                            >
                              "
                              {renderTextWithHighlights(
                                item.bukti_dokumen || ''
                              )}
                              "
                            </blockquote>
                          </div>
                        )}
                      </div>
                    ))}
                  {(!data.divergensi || data.divergensi.length === 0) && (
                    <p
                      style={{
                        ...paraStyle,
                        color: textSecondary,
                        fontStyle: 'italic',
                      }}
                    >
                      Tidak ada perbedaan signifikan ditemukan.
                    </p>
                  )}
                </div>
              </SectionCard>

              {/* 3. Kritik Akademis */}
              <SectionCard
                index={3}
                title="Kritik Akademis (Kelemahan & Bias)"
                icon="⚖️"
                accentColor="#f59e0b"
                isDark={isDark}
                defaultOpen={false}
              >
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                >
                  {data.kritik_akademis &&
                    data.kritik_akademis.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '16px',
                          backgroundColor: isDark
                            ? 'rgba(245,158,11,0.05)'
                            : '#fffbeb',
                          borderRadius: '12px',
                          border: `1px solid rgba(245,158,11,0.2)`,
                          boxShadow: '0 1px 3px rgba(245,158,11,0.05)',
                        }}
                      >
                        {getUnifiedCritiqueBadge(
                          item.aspek_yang_dikritik || 'Metodologi',
                          item.dokumen_sasaran || 'Dokumen Tidak Diketahui'
                        )}

                        <p
                          style={{
                            ...paraStyle,
                            marginBottom: '8px',
                            fontWeight: 600,
                            color: isDark ? '#fbbf24' : '#b45309',
                            fontSize: 13,
                          }}
                        >
                          {renderTextWithHighlights(
                            item.kelemahan_metodologi ||
                              item.celah_metodologis_atau_klaim ||
                              ''
                          )}
                        </p>
                        <p
                          style={{
                            ...paraStyle,
                            marginBottom: '12px',
                            color: textPrimary,
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: 11,
                              textTransform: 'uppercase',
                              letterSpacing: '0.02em',
                              color: '#f59e0b',
                            }}
                          >
                            Dampak:{' '}
                          </span>
                          {renderTextWithHighlights(
                            item.dampak_terhadap_kesimpulan ||
                              item.dampak_kelemahan ||
                              ''
                          )}
                        </p>
                        {item.sumber_bukti ? (
                          <div
                            style={{
                              padding: '10px 14px',
                              backgroundColor: isDark
                                ? 'rgba(0,0,0,0.2)'
                                : 'rgba(245,158,11,0.08)',
                              borderRadius: '8px',
                              borderLeft: '3px solid #f59e0b',
                            }}
                          >
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: textSecondary,
                                textTransform: 'uppercase',
                                marginBottom: 4,
                                letterSpacing: '0.05em',
                              }}
                            >
                              Kutipan Bukti
                            </div>
                            <blockquote
                              style={{
                                ...paraStyle,
                                margin: 0,
                                fontStyle: 'italic',
                                color: textSecondary,
                              }}
                            >
                              "
                              {renderTextWithHighlights(
                                item.sumber_bukti.kutipan_verbatim || ''
                              )}
                              "
                            </blockquote>
                          </div>
                        ) : (
                          <div
                            style={{
                              padding: '10px 14px',
                              backgroundColor: isDark
                                ? 'rgba(0,0,0,0.2)'
                                : 'rgba(245,158,11,0.08)',
                              borderRadius: '8px',
                              borderLeft: '3px solid #f59e0b',
                            }}
                          >
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: textSecondary,
                                textTransform: 'uppercase',
                                marginBottom: 4,
                                letterSpacing: '0.05em',
                              }}
                            >
                              Kutipan Bukti
                            </div>
                            <blockquote
                              style={{
                                ...paraStyle,
                                margin: 0,
                                fontStyle: 'italic',
                                color: textSecondary,
                              }}
                            >
                              "
                              {renderTextWithHighlights(
                                item.bukti_dokumen || item.dokumen_sasaran || ''
                              )}
                              "
                            </blockquote>
                          </div>
                        )}
                      </div>
                    ))}
                  {(!data.kritik_akademis ||
                    data.kritik_akademis.length === 0) && (
                    <p
                      style={{
                        ...paraStyle,
                        color: textSecondary,
                        fontStyle: 'italic',
                      }}
                    >
                      Tidak ada kritik akademis yang relevan.
                    </p>
                  )}
                </div>
              </SectionCard>

              {/* 4. Sintesis Objektif */}
              <SectionCard
                index={4}
                title="Sintesis Objektif"
                icon="💡"
                accentColor="#8b5cf6"
                isDark={isDark}
                defaultOpen={false}
              >
                <p
                  style={{
                    ...paraStyle,
                    marginBottom: 0,
                    fontWeight: 500,
                    lineHeight: 1.6,
                  }}
                >
                  {renderTextWithHighlights(
                    data.sintesis_objektif || 'Sintesis tidak tersedia.'
                  )}
                </p>
              </SectionCard>

              {/* 5. Keterbatasan Analisis */}
              <SectionCard
                index={5}
                title="Keterbatasan Analisis"
                icon="⚠️"
                accentColor="#ef4444"
                isDark={isDark}
                defaultOpen={false}
              >
                <p
                  style={{
                    ...paraStyle,
                    marginBottom: 0,
                    fontStyle: 'italic',
                    color: textSecondary,
                  }}
                >
                  {renderTextWithHighlights(
                    data.keterbatasan_analisis ||
                      'Tidak ada keterbatasan yang dilaporkan.'
                  )}
                </p>
              </SectionCard>
            </div>

            {/* ══ FOOTER ════════════════════════════════════════════════ */}
            <div
              style={{
                padding: '10px 20px 20px',
                borderTop: `1px solid ${borderColor}`,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 11, color: textSecondary }}>
                🔍 Sumber: Analisis AI berdasarkan {articleTitles.length || 2}{' '}
                artikel yang dipilih
              </span>
              <span style={{ color: borderColor }}>•</span>
              <span style={{ fontSize: 11, color: textSecondary }}>
                Dibuat pada: {dateStr}
              </span>
            </div>
          </>
        ) : null}
      </div>{' '}
      {/* end ca-content-root */}
    </div>
  );
}

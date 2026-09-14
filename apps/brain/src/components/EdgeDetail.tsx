'use client';

import {
  Modal,
  Table,
  Text,
  Loader,
  Skeleton,
  Group,
  Badge,
  Paper,
  ThemeIcon,
  Box,
  Stack,
  Button,
  Transition,
  ActionIcon,
} from '@mantine/core';
import { ExtendedEdge } from '@/types';
import { useEffect, useState, useRef, useCallback } from 'react';
import {
  IconArrowDown,
  IconNetwork,
  IconArticle,
  IconEye,
  IconArrowsSplit2,
  IconNotes,
  IconCheck,
} from '@tabler/icons-react';

interface EdgeDetailProps {
  edge: ExtendedEdge | null;
  onClose: () => void;
  onOpenNodeDetail?: (nodeId: string) => void;
  onDeepCompare?: (nodeIds: string[]) => void;
  onSaveNote?: (
    text: string,
    customLabel?: string,
    articleId?: string
  ) => Promise<void>;
}

interface PopulatedEdge {
  id: string;
  label: string | null;
  relation: string | null;
  from: {
    id: string;
    title: string;
  };
  to: {
    id: string;
    title: string;
  };
}

const relationDisplayNames: Record<string, string> = {
  background: 'Latar Belakang',
  method: 'Metodologi',
  goal: 'Tujuan',
  future: 'Arahan Masa Depan',
  gap: 'Gap Penelitian',
};

const relationColors: Record<string, string> = {
  background: 'blue',
  method: 'green',
  gap: 'red',
  future: 'violet',
  goal: 'orange',
};

function getDisplayRelation(relation: string | null | undefined) {
  if (!relation) return '-';
  // Map API relation to display key
  const mapping: Record<string, string> = {
    SIMILAR_BACKGROUND: 'background',
    SIMILAR_METHODOLOGY: 'method',
    SIMILAR_OBJECTIVE: 'goal',
    SIMILAR_GAP: 'gap',
    SIMILAR_FUTUREWORK: 'future',
  };
  const internalKey = mapping[relation] || relation;
  return relationDisplayNames[internalKey] || relation;
}

function getRelationColor(relation: string | null | undefined) {
  if (!relation) return 'gray';
  const mapping: Record<string, string> = {
    SIMILAR_BACKGROUND: 'background',
    SIMILAR_METHODOLOGY: 'method',
    SIMILAR_OBJECTIVE: 'goal',
    SIMILAR_GAP: 'gap',
    SIMILAR_FUTUREWORK: 'future',
  };
  const key = mapping[relation] || relation;
  return relationColors[key] || 'gray';
}

export default function EdgeDetail({
  edge,
  onClose,
  onOpenNodeDetail,
  onDeepCompare,
  onSaveNote,
}: EdgeDetailProps) {
  const [edgeNode, setEdgeNode] = useState<PopulatedEdge>();
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Floating Save Button State ───────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [floatBtn, setFloatBtn] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedHighlights, setSavedHighlights] = useState<string[]>([]);
  const [noteComment, setNoteComment] = useState('');

  // Deteksi text selection
  const handleMouseUp = useCallback(() => {
    if (!onSaveNote) return;
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!text || text.length < 5) {
      setFloatBtn(null);
      setNoteComment('');
      return;
    }
    // Pastikan seleksi ada di dalam container ini
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
  }, [onSaveNote]);

  // Tutup button saat klik di luar
  useEffect(() => {
    const hide = (e: MouseEvent) => {
      const btn = document.getElementById('edge-save-note-container');
      if (btn && btn.contains(e.target as Node)) return;
      setFloatBtn(null);
    };
    document.addEventListener('mousedown', hide);
    return () => document.removeEventListener('mousedown', hide);
  }, []);

  const handleSaveNoteAction = async () => {
    if (!floatBtn || !onSaveNote) return;
    setSaving(true);
    try {
      const relLabel = getDisplayRelation(edge?.relation);
      const customLabel = `Relasi: ${relLabel}`;
      const articleId = edgeNode?.from?.id;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (onSaveNote as any)(
        floatBtn.text,
        customLabel,
        articleId,
        noteComment
      );

      setSaved(true);
      setSavedHighlights((prev) => [...prev, floatBtn.text]);
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

  const renderTextWithHighlights = (text: string) => {
    if (savedHighlights.length === 0 || !text) return text;
    const sortedHighlights = [...savedHighlights].sort(
      (a, b) => b.length - a.length
    );
    let result: React.ReactNode[] = [text];
    sortedHighlights.forEach((highlight) => {
      const newResult: React.ReactNode[] = [];
      result.forEach((part) => {
        if (typeof part === 'string') {
          const pieces = part.split(highlight);
          pieces.forEach((piece, i) => {
            newResult.push(piece);
            if (i < pieces.length - 1) {
              newResult.push(
                <mark
                  key={`${highlight}-${i}`}
                  style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.25)',
                    color: 'inherit',
                    borderRadius: '2px',
                    padding: '0 2px',
                  }}
                >
                  {highlight}
                </mark>
              );
            }
          });
        } else {
          newResult.push(part);
        }
      });
      result = newResult;
    });
    return <>{result}</>;
  };

  useEffect(() => {
    if (!edge) return;

    // Reset state on new edge selection
    setFetchError(null);
    setLoading(false);

    // Fast path: titles already available on the edge object (from vis-network data)
    if (edge.fromTitle && edge.toTitle) {
      setEdgeNode({
        id: edge.id?.toString() ?? '',
        relation: edge.relation || null,
        from: { id: edge.from?.toString() ?? '', title: edge.fromTitle },
        to: { id: edge.to?.toString() ?? '', title: edge.toTitle },
        label: edge.label || '',
      });
      return;
    }

    // No legacy API fallback: build minimal node detail from current edge payload.
    setEdgeNode({
      id: edge.id?.toString() ?? '',
      relation: edge.relation || null,
      from: { id: edge.from?.toString() ?? '', title: 'Artikel sumber' },
      to: { id: edge.to?.toString() ?? '', title: 'Artikel tujuan' },
      label: edge.label || '',
    });
  }, [edge?.id]);

  if (!edge) return null;

  if (fetchError) {
    return (
      <Paper p="md" radius="md" withBorder>
        <Text size="sm" c="red">
          {fetchError}
        </Text>
      </Paper>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      style={{ position: 'relative' }}
    >
      <Stack gap="lg">
        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Badge
              size="lg"
              variant="dot"
              color={getRelationColor(edge.relation)}
            >
              {getDisplayRelation(edge.relation)}
            </Badge>
            <ThemeIcon
              size="lg"
              variant="light"
              color={getRelationColor(edge.relation)}
              radius="md"
            >
              <IconNetwork size={20} />
            </ThemeIcon>
          </Group>

          <Stack gap="lg">
            <Paper p="sm" radius="md" bg="var(--mantine-color-default-hover)">
              <Group align="flex-start">
                <ThemeIcon size="md" variant="light" color="blue">
                  <IconArticle size={16} />
                </ThemeIcon>
                <Box style={{ flex: 1 }}>
                  <Text size="sm" fw={500} color="dimmed">
                    Dari Artikel:
                  </Text>
                  <Box>
                    {loading ? (
                      <Skeleton height={20} width="100%" />
                    ) : (
                      <>
                        <Box
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <Text size="md" style={{ wordBreak: 'break-word' }}>
                            {renderTextWithHighlights(
                              edgeNode?.from?.title || ''
                            )}
                          </Text>
                          {edgeNode?.from?.id && onOpenNodeDetail && (
                            <ThemeIcon
                              size="sm"
                              variant="light"
                              color="gray"
                              style={{ cursor: 'pointer' }}
                              onClick={() => onOpenNodeDetail(edgeNode.from.id)}
                            >
                              <IconEye size={16} />
                            </ThemeIcon>
                          )}
                        </Box>
                      </>
                    )}
                  </Box>
                </Box>
              </Group>
            </Paper>

            <Group justify="center">
              <ThemeIcon
                size="md"
                variant="light"
                color={getRelationColor(edge.relation)}
              >
                <IconArrowDown size={16} />
              </ThemeIcon>
            </Group>

            <Paper p="sm" radius="md" bg="var(--mantine-color-default-hover)">
              <Group align="flex-start">
                <ThemeIcon size="md" variant="light" color="blue">
                  <IconArticle size={16} />
                </ThemeIcon>
                <Box style={{ flex: 1 }}>
                  <Text size="sm" fw={500} color="dimmed">
                    Ke Artikel:
                  </Text>
                  <Box>
                    {loading ? (
                      <Skeleton height={20} width="100%" />
                    ) : (
                      <>
                        <Box
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <Text size="md" style={{ wordBreak: 'break-word' }}>
                            {renderTextWithHighlights(
                              edgeNode?.to?.title || ''
                            )}
                          </Text>
                          {edgeNode?.to?.id && onOpenNodeDetail && (
                            <ThemeIcon
                              size="sm"
                              variant="light"
                              color="gray"
                              style={{ cursor: 'pointer' }}
                              onClick={() => onOpenNodeDetail(edgeNode.to.id)}
                            >
                              <IconEye size={16} />
                            </ThemeIcon>
                          )}
                        </Box>
                      </>
                    )}
                  </Box>
                </Box>
              </Group>
            </Paper>
          </Stack>
        </Paper>

        {edge.label && (
          <Paper p="md" radius="md" withBorder>
            <Text size="sm" fw={500} color="dimmed" mb="xs">
              Deskripsi Hubungan:
            </Text>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {renderTextWithHighlights(
                edge.label || edge.displayDescription || ''
              )}
            </Text>
          </Paper>
        )}

        {/* ── Tombol Comparative Analysis ── */}
        {onDeepCompare && edgeNode?.from?.id && edgeNode?.to?.id && (
          <Button
            fullWidth
            size="sm"
            radius="md"
            variant="gradient"
            gradient={{ from: 'indigo', to: 'teal', deg: 135 }}
            leftSection={<IconArrowsSplit2 size={16} />}
            onClick={() => onDeepCompare([edgeNode.from.id, edgeNode.to.id])}
            style={{
              boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
              marginTop: 4,
            }}
          >
            Bandingkan Mendalam
          </Button>
        )}
      </Stack>

      {/* ══ FLOATING: Keterangan Catatan Tooltip ═══════════════════ */}
      <Transition
        mounted={!!floatBtn}
        transition="fade"
        duration={120}
        timingFunction="ease"
      >
        {(styles) => (
          <div
            id="edge-save-note-container"
            style={{
              ...styles,
              position: 'absolute',
              left: floatBtn?.x || 0,
              top: floatBtn?.y || 0,
              transform: 'translateX(-50%)',
              zIndex: 1000,
              padding: '10px',
              borderRadius: '10px',
              backgroundColor: 'var(--mantine-color-body)',
              border: '1px solid var(--mantine-color-default-border)',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              minWidth: '240px',
            }}
          >
            <Stack gap={6}>
              <Text
                size="xs"
                fw={800}
                c="blue"
                style={{ letterSpacing: '0.02em' }}
              >
                Keterangan Catatan:
              </Text>
              <Group gap={6} align="flex-end">
                <input
                  type="text"
                  autoFocus
                  placeholder="Tulis catatan di sini..."
                  value={noteComment}
                  onChange={(e) => setNoteComment(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--mantine-color-default-border)',
                    backgroundColor: 'var(--mantine-color-default-hover)',
                    color: 'var(--mantine-color-text)',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !saving && !saved) {
                      handleSaveNoteAction();
                    }
                  }}
                />
                <ActionIcon
                  color={saved ? 'green' : 'blue'}
                  variant="filled"
                  size="md"
                  loading={saving}
                  onClick={handleSaveNoteAction}
                  disabled={saved}
                >
                  {saved ? <IconCheck size={16} /> : <IconNotes size={16} />}
                </ActionIcon>
              </Group>
            </Stack>
          </div>
        )}
      </Transition>
    </div>
  );
}

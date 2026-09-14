'use client';

import type React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PdfLoader,
  PdfHighlighter,
  Highlight,
  Popup,
  AreaHighlight,
} from 'react-pdf-highlighter';
import type {
  Content,
  IHighlight,
  NewHighlight,
  ScaledPosition,
} from 'react-pdf-highlighter';
import {
  Button,
  Group,
  Card,
  Text,
  ScrollArea,
  Title,
  Divider,
  Stack,
  useMantineColorScheme,
  useMantineTheme,
  ActionIcon,
  Loader,
  Tooltip,
  Box,
} from '@mantine/core';
import {
  IconTrash,
  IconDownload,
  IconChevronRight,
  IconChevronLeft,
  IconMinus,
  IconPlus,
  IconBook,
  IconBookOff,
  IconMaximize,
} from '@tabler/icons-react';
import 'react-pdf-highlighter/dist/style.css';
import { useXapiTracking } from '@/hooks/useXapiTracking';
import { PDFDocument, rgb } from 'pdf-lib';

interface WebViewerProps {
  fileUrl: string;
  onAnalytics?: (data: unknown) => void;
  session?: {
    projectId?: string;
    id?: string;
    [key: string]: unknown;
  } | null;
  articleId?: string;
  onSave?: () => void;
  hideInternalToolbar?: boolean;
}

interface AnnotationFromAPI {
  id: string;
  page: number;
  highlightedText: string;
  comment: string;
  articleId: string;
  userId: string;
  createdAt: string;
  semanticTag?: string; // ✅ Gunakan semanticTag untuk menyimpan positionData
  article: {
    id: string;
    title: string;
    filePath: string;
    projectId?: string;
  };
}

const WebViewer: React.FC<WebViewerProps> = ({
  fileUrl,
  onAnalytics,
  session,
  articleId,
  onSave,
  hideInternalToolbar = false,
}) => {
  const [highlights, setHighlights] = useState<IHighlight[]>([]);
  const [isLoadingAnnotations, setIsLoadingAnnotations] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [notesOpen, setNotesOpen] = useState(true); // toggle Highlighted Notes
  const [pdfScale, setPdfScale] = useState<number>(1.0); // zoom level
  const [readingMode, setReadingMode] = useState(false); // Mode Baca — sembunyikan notes panel
  const [resizeTrigger, setResizeTrigger] = useState(false); // Hack untuk trigger zoom
  const scrollViewerTo = useRef<(highlight: IHighlight) => void>(() => {});

  // ✅ Fungsi scroll yang aman
  const safeScrollTo = useCallback((highlight: IHighlight) => {
    if (!scrollViewerTo.current) return;

    let attempts = 0;
    const tryScroll = () => {
      try {
        const viewerEl = document.querySelector('.PdfHighlighter');
        if (viewerEl && (viewerEl as HTMLElement).offsetParent) {
          scrollViewerTo.current(highlight);
        } else if (attempts < 15) {
          attempts++;
          setTimeout(tryScroll, 100);
        }
      } catch (err) {
        // Abaikan error
      }
    };

    tryScroll();
  }, []);

  // Trigger resize internal library saat scale berubah
  useEffect(() => {
    setResizeTrigger((t) => !t);
  }, [pdfScale]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const touchDistRef = useRef<number | null>(null); // Untuk tracking jarak cubitan touch

  const { colorScheme } = useMantineColorScheme();
  const theme = useMantineTheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const width = entry.contentRect.width;
        const narrow = width < 750;
        setIsNarrow(narrow);
        if (width < 600) setNotesOpen(false);
      }
    });

    // ✅ Gesture / Wheel Zoom support (Pinch-to-zoom & Ctrl+Scroll)
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        // Hapus hash untuk mencegah library auto-scroll saat sedang transisi zoom
        if (window.location.hash)
          window.history.replaceState(null, '', window.location.pathname);

        const zoomFactor = Math.pow(1.1, -e.deltaY / 120);
        setPdfScale((s) => {
          const newScale = Math.min(Math.max(0.25, s * zoomFactor), 4.0);
          return parseFloat(newScale.toFixed(2));
        });
      }
    };

    // ✅ Touch Pinch-to-zoom support
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        if (window.location.hash)
          window.history.replaceState(null, '', window.location.pathname);
        touchDistRef.current = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY
        );
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchDistRef.current !== null) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY
        );

        const zoomFactor = dist / touchDistRef.current;
        setPdfScale((s) => {
          const newScale = Math.min(Math.max(0.25, s * zoomFactor), 4.0);
          return parseFloat(newScale.toFixed(2));
        });
        touchDistRef.current = dist;
      }
    };

    const handleTouchEnd = () => {
      touchDistRef.current = null;
    };

    const container = containerRef.current;
    if (container) {
      observer.observe(container);
      // Gunakan capture: true agar kita menangkap event sebelum library internal menangkapnya
      container.addEventListener('wheel', handleWheel, {
        passive: false,
        capture: true,
      });
      container.addEventListener('touchstart', handleTouchStart, {
        passive: false,
        capture: true,
      });
      container.addEventListener('touchmove', handleTouchMove, {
        passive: false,
        capture: true,
      });
      container.addEventListener('touchend', handleTouchEnd, { capture: true });
    }

    return () => {
      observer.disconnect();
      if (container) {
        container.removeEventListener('wheel', handleWheel, { capture: true });
        container.removeEventListener('touchstart', handleTouchStart, {
          capture: true,
        });
        container.removeEventListener('touchmove', handleTouchMove, {
          capture: true,
        });
        container.removeEventListener('touchend', handleTouchEnd, {
          capture: true,
        });
      }
    };
  }, []);

  const { trackTextSelection, trackAnnotationAttempt, trackAnnotationSave } =
    useXapiTracking(session);

  // ✅ FIX: Load annotations dengan dependency yang lebih spesifik
  useEffect(() => {
    const loadAnnotations = async () => {
      // ✅ FIXED: Prioritaskan projectId dulu (ini brainstorming session ID yang benar)
      const projectId = session?.projectId || session?.projectId || session?.id;

      // ✅ Jika tidak ada session, tunggu dulu
      if (!session) {
        setIsLoadingAnnotations(true);
        return;
      }

      if (!projectId) {
        setIsLoadingAnnotations(false);
        return;
      }

      try {
        const apiUrl = `/api/annotation?projectId=${projectId}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
          throw new Error('Failed to load annotations');
        }

        const annotations: AnnotationFromAPI[] = await response.json();

        // Filter annotations for current document
        const currentDocAnnotations = annotations.filter((ann) => {
          if (!ann.article?.filePath) return false;

          const normalizeUrl = (url: string) => url.toLowerCase().trim();
          const normalizedFilePath = normalizeUrl(ann.article.filePath);
          const normalizedFileUrl = normalizeUrl(fileUrl);

          return (
            normalizedFilePath === normalizedFileUrl ||
            normalizedFileUrl.includes(normalizedFilePath) ||
            normalizedFilePath.includes(normalizedFileUrl)
          );
        });

        // ✅ Convert API annotations to IHighlight format (ambil dari semanticTag)
        const loadedHighlights: IHighlight[] = currentDocAnnotations
          .map((ann) => {
            try {
              const position = ann.semanticTag
                ? JSON.parse(ann.semanticTag)
                : {
                    pageNumber: ann.page,
                    boundingRect: {
                      x1: 0,
                      y1: 0,
                      x2: 0,
                      y2: 0,
                      width: 0,
                      height: 0,
                    },
                    rects: [],
                  };

              const highlight: IHighlight = {
                id: ann.id,
                content: { text: ann.highlightedText || '' },
                position,
                comment: {
                  text: ann.comment || '',
                  emoji: '',
                },
              };

              return highlight;
            } catch (error) {
              console.error(
                '❌ Error parsing annotation position:',
                error,
                ann
              );
              return null;
            }
          })
          .filter((h): h is IHighlight => h !== null);

        setHighlights(loadedHighlights);
      } catch (error) {
        console.error('❌ Error loading annotations:', error);
      } finally {
        setIsLoadingAnnotations(false);
      }
    };

    loadAnnotations();
  }, [session, fileUrl]);

  const parseIdFromHash = () =>
    document.location.hash.replace(/^#highlight-/, '');
  const resetHash = () => {
    document.location.hash = '';
  };

  const scrollToHighlightFromHash = useCallback(() => {
    const highlight = highlights.find((h) => h.id === parseIdFromHash());
    if (highlight) {
      safeScrollTo(highlight);
    }
  }, [highlights, safeScrollTo]);

  // Scroll when highlights are loaded for the first time
  useEffect(() => {
    if (highlights.length > 0 && parseIdFromHash()) {
      scrollToHighlightFromHash();
    }
  }, [highlights.length, scrollToHighlightFromHash]);

  useEffect(() => {
    window.addEventListener('hashchange', scrollToHighlightFromHash);
    return () => {
      window.removeEventListener('hashchange', scrollToHighlightFromHash);
    };
  }, [scrollToHighlightFromHash]);

  const addHighlight = async (highlight: NewHighlight) => {
    const highlightedText =
      typeof highlight.content === 'string'
        ? highlight.content
        : highlight.content?.text || '';
    const commentText = highlight.comment?.text || '';
    const sanitizedComment = {
      text: commentText.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim(),
      emoji: '',
    };

    trackTextSelection(highlightedText, `PDF document: ${fileUrl}`);

    const tempId = Math.random().toString(36).slice(2);
    const tempHighlight: IHighlight = {
      id: tempId,
      content: highlight.content,
      position: highlight.position,
      comment: sanitizedComment,
    };

    setHighlights((prev) => [tempHighlight, ...prev]);

    try {
      const response = await fetch('/api/annotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'annotation_add',
          document: fileUrl,
          metadata: {
            annotationType: 'Highlight',
            contents: sanitizedComment.text,
            highlightedText,
            pageNumber: highlight.position.pageNumber,
            rect: highlight.position.boundingRect,
            positionData: JSON.stringify(highlight.position),
          },
          timeStamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) throw new Error('Failed to save annotation');

      const savedAnnotation = await response.json();
      setHighlights((prev) =>
        prev.map((h) =>
          h.id === tempId ? { ...h, id: savedAnnotation.id } : h
        )
      );

      trackAnnotationSave(highlightedText, sanitizedComment.text, fileUrl);
      onSave?.();
    } catch (error) {
      console.error('❌ Error saving annotation to API:', error);
    }
  };

  const deleteHighlight = async (highlightId: string) => {
    try {
      const response = await fetch(`/api/annotation/${highlightId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete annotation');

      setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
    } catch (error) {
      console.error('Error deleting annotation:', error);
    }
  };

  const updateHighlight = (
    highlightId: string,
    position: Partial<ScaledPosition>,
    content: Partial<Content>
  ) => {
    setHighlights((prev) =>
      prev.map((h) =>
        h.id === highlightId
          ? {
              ...h,
              position: { ...h.position, ...position },
              content: { ...h.content, ...content },
            }
          : h
      )
    );
  };

  const handleDownloadWithHighlights = async () => {
    setIsDownloading(true);
    try {
      const existingPdfBytes = await fetch(fileUrl).then((res) =>
        res.arrayBuffer()
      );
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();

      highlights.forEach((highlight) => {
        const pageIndex = highlight.position.pageNumber - 1;
        if (pageIndex >= 0 && pageIndex < pages.length) {
          const page = pages[pageIndex];
          const { width: pdfPageWidth, height: pdfPageHeight } = page.getSize();

          const viewportWidth =
            highlight.position.boundingRect?.width || pdfPageWidth;
          const viewportHeight =
            highlight.position.boundingRect?.height || pdfPageHeight;
          const scaleX = pdfPageWidth / viewportWidth;
          const scaleY = pdfPageHeight / viewportHeight;

          if (highlight.position.rects && highlight.position.rects.length > 0) {
            highlight.position.rects.forEach((rect) => {
              const x1 = rect.x1 * scaleX;
              const y1 = rect.y1 * scaleY;
              const x2 = rect.x2 * scaleX;
              const y2 = rect.y2 * scaleY;

              page.drawRectangle({
                x: x1,
                y: pdfPageHeight - y2,
                width: x2 - x1,
                height: y2 - y1,
                color: rgb(1, 1, 0),
                opacity: 0.4,
                borderWidth: 0,
              });
            });
          } else if (highlight.position.boundingRect) {
            const rect = highlight.position.boundingRect;
            const x1 = rect.x1 * scaleX;
            const y1 = rect.y1 * scaleY;
            const x2 = rect.x2 * scaleX;
            const y2 = rect.y2 * scaleY;

            page.drawRectangle({
              x: x1,
              y: pdfPageHeight - y2,
              width: x2 - x1,
              height: y2 - y1,
              color: rgb(1, 1, 0),
              opacity: 0.4,
              borderWidth: 0,
            });
          }

          if (highlight.comment?.text) {
            const rect =
              highlight.position.rects?.[0] || highlight.position.boundingRect;
            if (rect) {
              const x1 = rect.x1 * scaleX;
              const y2 = rect.y2 * scaleY;
              const commentX = x1 + 2;
              const commentY = pdfPageHeight - y2 - 12;
              const fontSize = 8;
              const maxWidth = Math.min(300, pdfPageWidth - commentX - 10);

              try {
                const textWidth = Math.min(
                  highlight.comment.text.length * fontSize * 0.5,
                  maxWidth
                );
                page.drawRectangle({
                  x: commentX - 2,
                  y: commentY - 2,
                  width: textWidth + 4,
                  height: fontSize + 4,
                  color: rgb(1, 1, 0.9),
                  opacity: 0.9,
                });
                page.drawText(highlight.comment.text, {
                  x: commentX,
                  y: commentY,
                  size: fontSize,
                  color: rgb(0, 0, 0),
                  maxWidth: maxWidth,
                });
              } catch (error) {
                console.error('Error drawing comment:', error);
              }
            }
          }
        }
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], {
        type: 'application/pdf',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download =
        `${fileUrl.split('/').pop()?.replace('.pdf', '')}_highlighted.pdf` ||
        'document_highlighted.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF with highlights:', error);
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileUrl.split('/').pop() || 'document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsDownloading(false);
    }
  };

  const HighlightPopup = ({
    comment,
  }: {
    comment: { text: string; emoji: string };
  }) =>
    comment?.text ? (
      <div
        className="Highlight__popup"
        style={{
          backgroundColor: isDark ? theme.colors.dark[6] : theme.colors.gray[0],
          color: isDark ? theme.colors.gray[0] : theme.colors.dark[7],
          border: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
          borderRadius: theme.radius.sm,
          padding: '8px 12px',
          boxShadow: isDark
            ? `0 2px 8px ${theme.colors.dark[9]}`
            : `0 2px 8px ${theme.colors.gray[3]}`,
          fontSize: '14px',
          maxWidth: '200px',
        }}
      >
        {comment.text
          ? comment.text.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim()
          : ''}
      </div>
    ) : null;

  const CustomTip = ({
    onConfirm,
    onOpen,
  }: {
    onConfirm: (comment: { text: string; emoji: string }) => void;
    onOpen: () => void;
  }) => {
    const [text, setText] = useState('');

    useEffect(() => {
      onOpen();
    }, [onOpen]);

    return (
      <div
        className="PdfHighlighter__tip-container"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          backgroundColor: isDark ? theme.colors.dark[6] : theme.colors.gray[0],
          border: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
          borderRadius: theme.radius.sm,
          padding: '8px',
          boxShadow: isDark
            ? `0 2px 8px ${theme.colors.dark[9]}`
            : `0 2px 8px ${theme.colors.gray[3]}`,
        }}
      >
        <div className="PdfHighlighter__tip-compact">
          <input
            type="text"
            placeholder="Add note..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: '150px',
              padding: '4px 8px',
              marginBottom: '8px',
              border: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
              borderRadius: theme.radius.sm,
              backgroundColor: isDark
                ? theme.colors.dark[7]
                : theme.colors.gray[0],
              color: isDark ? theme.colors.gray[0] : theme.colors.dark[7],
            }}
          />
          <button
            type="submit"
            onClick={() => {
              onConfirm({
                text: text.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim(),
                emoji: '',
              });
              window.getSelection()?.removeAllRanges();
            }}
            style={{
              padding: '4px 12px',
              backgroundColor: theme.colors.blue[6],
              color: 'white',
              border: 'none',
              borderRadius: theme.radius.sm,
              cursor: 'pointer',
            }}
          >
            Add
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: isDark ? theme.colors.dark[7] : theme.colors.gray[0],
        color: isDark ? theme.colors.gray[0] : theme.colors.dark[7],
        position: 'relative',
      }}
    >
      {/* ─── Toolbar (Hanya muncul jika tidak disembunyikan) ─── */}
      {!hideInternalToolbar && (
        <Group
          justify="space-between"
          p="xs"
          style={{
            backgroundColor: isDark
              ? theme.colors.dark[6]
              : theme.colors.gray[1],
            borderBottom: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
            flexShrink: 0,
          }}
        >
          {/* Zoom controls — kiri */}
          <Group gap={4}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={() =>
                setPdfScale((s) =>
                  Math.max(0.25, parseFloat((s - 0.25).toFixed(2)))
                )
              }
            >
              <IconMinus size={14} />
            </ActionIcon>
            <Text
              size="xs"
              style={{
                minWidth: 40,
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {Math.round(pdfScale * 100)}%
            </Text>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={() =>
                setPdfScale((s) =>
                  Math.min(4.0, parseFloat((s + 0.25).toFixed(2)))
                )
              }
            >
              <IconPlus size={14} />
            </ActionIcon>
          </Group>

          {/* Download + Toggle Notes + Mode Baca — kanan */}
          <Group gap={8}>
            <Tooltip
              label="Download PDF dengan Highlight"
              position="bottom"
              withArrow
            >
              <Button
                onClick={handleDownloadWithHighlights}
                variant="light"
                size="xs"
                color="blue"
                leftSection={<IconDownload size={14} />}
                loading={isDownloading}
              >
                Download
              </Button>
            </Tooltip>

            <Tooltip
              label={notesOpen ? 'Sembunyikan Catatan' : 'Tampilkan Catatan'}
              position="bottom"
              withArrow
            >
              <ActionIcon
                variant={notesOpen ? 'filled' : 'light'}
                color={notesOpen ? 'indigo' : 'gray'}
                size="md"
                radius="md"
                onClick={() => setNotesOpen((o) => !o)}
              >
                {notesOpen ? <IconBook size={16} /> : <IconBookOff size={16} />}
              </ActionIcon>
            </Tooltip>

            <Tooltip
              label={readingMode ? 'Keluar Mode Fokus' : 'Mode Fokus Membaca'}
              position="bottom"
              withArrow
            >
              <Button
                variant={readingMode ? 'filled' : 'light'}
                color={readingMode ? 'teal' : 'gray'}
                size="xs"
                radius="md"
                onClick={() => {
                  setReadingMode(!readingMode);
                  if (!readingMode) setNotesOpen(false);
                  else setNotesOpen(true);
                }}
              >
                {readingMode ? 'Keluar Fokus' : 'Fokus'}
              </Button>
            </Tooltip>
          </Group>
        </Group>
      )}

      {/* Floating Zoom Control jika toolbar disembunyikan */}
      {hideInternalToolbar && !readingMode && (
        <Box
          style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 500,
            backgroundColor: isDark
              ? 'rgba(30,31,40,0.85)'
              : 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(10px)',
            padding: '4px 12px',
            borderRadius: 999,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={() =>
              setPdfScale((s) =>
                Math.max(0.25, parseFloat((s - 0.25).toFixed(2)))
              )
            }
          >
            <IconMinus size={14} />
          </ActionIcon>
          <Text
            size="xs"
            fw={700}
            style={{ minWidth: 40, textAlign: 'center' }}
          >
            {Math.round(pdfScale * 100)}%
          </Text>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={() =>
              setPdfScale((s) =>
                Math.min(4.0, parseFloat((s + 0.25).toFixed(2)))
              )
            }
          >
            <IconPlus size={14} />
          </ActionIcon>
          <Divider orientation="vertical" h={14} />
          <Tooltip label={notesOpen ? 'Tutup Catatan' : 'Buka Catatan'}>
            <ActionIcon
              variant={notesOpen ? 'filled' : 'light'}
              color="indigo"
              size="sm"
              radius="xl"
              onClick={() => setNotesOpen(!notesOpen)}
            >
              <IconBook size={14} />
            </ActionIcon>
          </Tooltip>
        </Box>
      )}

      {/* ─── Panah navigasi fixed — selalu di atas konten PDF ─── */}
      {readingMode && (
        <>
          <button
            onClick={() => {
              const el = document.querySelector(
                '.PdfHighlighter'
              ) as HTMLElement;
              el?.scrollBy({ top: -el.clientHeight * 0.9, behavior: 'smooth' });
            }}
            title="Scroll ke atas"
            style={{
              position: 'fixed',
              left: 40,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 9999,
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'}`,
              background: isDark
                ? 'rgba(15,16,22,0.85)'
                : 'rgba(255,255,255,0.95)',
              color: isDark ? '#e2e8f0' : '#1e293b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              backdropFilter: 'blur(12px)',
              fontSize: 24,
              padding: 0,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
              e.currentTarget.style.background = isDark ? '#1e293b' : '#f8fafc';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
              e.currentTarget.style.background = isDark
                ? 'rgba(15,16,22,0.85)'
                : 'rgba(255,255,255,0.95)';
            }}
          >
            &#8592;
          </button>
          <button
            onClick={() => {
              const el = document.querySelector(
                '.PdfHighlighter'
              ) as HTMLElement;
              el?.scrollBy({ top: el.clientHeight * 0.9, behavior: 'smooth' });
            }}
            title="Scroll ke bawah"
            style={{
              position: 'fixed',
              right: 40,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 9999,
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'}`,
              background: isDark
                ? 'rgba(15,16,22,0.85)'
                : 'rgba(255,255,255,0.95)',
              color: isDark ? '#e2e8f0' : '#1e293b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              backdropFilter: 'blur(12px)',
              fontSize: 24,
              padding: 0,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
              e.currentTarget.style.background = isDark ? '#1e293b' : '#f8fafc';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
              e.currentTarget.style.background = isDark
                ? 'rgba(15,16,22,0.85)'
                : 'rgba(255,255,255,0.95)';
            }}
          >
            &#8594;
          </button>
        </>
      )}
      <style>{`
        /* Kontainer internal library - Selector super akurat via DOM structure */
        .pdf-viewer-wrapper > span + div > div {
          position: absolute !important;
          top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
          overflow: auto !important;
        }
        
        .pdfViewer {
          background-color: transparent !important;
          padding: 40px 0 !important;
        }

        .pdfViewer .page {
          margin: 0 auto 25px auto !important;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2) !important;
          border: 1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'} !important;
        }
      `}</style>
      <div
        style={{
          display: 'flex',
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          className="pdf-viewer-wrapper"
          style={{
            flex: notesOpen && !readingMode ? 3 : 1,
            position: 'relative',
            backgroundColor: isDark
              ? theme.colors.dark[8]
              : theme.colors.gray[0],
            transition: 'flex 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            height: '100%',
            overflow: 'hidden',
            width: resizeTrigger ? '100%' : 'calc(100% - 0.1px)',
          }}
        >
          <div
            ref={containerRef}
            style={{ width: '100%', height: '100%', position: 'relative' }}
          >
            <PdfLoader
              url={fileUrl}
              beforeLoad={
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    backgroundColor: isDark
                      ? theme.colors.dark[7]
                      : theme.colors.gray[0],
                    color: isDark ? theme.colors.gray[0] : theme.colors.dark[7],
                  }}
                >
                  <Stack align="center" gap="sm">
                    <Loader size="md" color="blue" variant="dots" />
                    <Text size="xs" fw={600} c="dimmed">
                      MENYIAPKAN PDF...
                    </Text>
                  </Stack>
                </div>
              }
            >
              {(pdfDocument) => (
                <PdfHighlighter
                  pdfDocument={pdfDocument}
                  enableAreaSelection={(event) => event.altKey}
                  pdfScaleValue={String(pdfScale)}
                  scrollRef={(scrollTo) => {
                    scrollViewerTo.current = scrollTo;
                    if (parseIdFromHash()) {
                      setTimeout(() => {
                        const h = highlights.find(
                          (hi) => hi.id === parseIdFromHash()
                        );
                        if (h) safeScrollTo(h);
                      }, 500);
                    }
                  }}
                  onScrollChange={resetHash}
                  onSelectionFinished={(
                    position,
                    content,
                    hideTipAndSelection,
                    transformSelection
                  ) => (
                    <CustomTip
                      onOpen={transformSelection}
                      onConfirm={(comment) => {
                        addHighlight({ content, position, comment });
                        hideTipAndSelection();
                      }}
                    />
                  )}
                  highlightTransform={(
                    highlight,
                    index,
                    setTip,
                    hideTip,
                    viewportToScaled,
                    screenshot,
                    isScrolledTo
                  ) => {
                    const isTextHighlight = !highlight.content?.image;
                    const component = isTextHighlight ? (
                      <Highlight
                        isScrolledTo={isScrolledTo}
                        position={highlight.position}
                        comment={highlight.comment}
                      />
                    ) : (
                      <AreaHighlight
                        isScrolledTo={isScrolledTo}
                        highlight={highlight}
                        onChange={(boundingRect) => {
                          updateHighlight(
                            highlight.id,
                            { boundingRect: viewportToScaled(boundingRect) },
                            { image: screenshot(boundingRect) }
                          );
                        }}
                      />
                    );
                    return (
                      <Popup
                        popupContent={
                          <HighlightPopup comment={highlight.comment} />
                        }
                        onMouseOver={() =>
                          setTip(highlight, () => (
                            <HighlightPopup comment={highlight.comment} />
                          ))
                        }
                        onMouseOut={hideTip}
                        key={index}
                      >
                        {component}
                      </Popup>
                    );
                  }}
                  highlights={highlights}
                />
              )}
            </PdfLoader>
          </div>
        </div>
        {/* ─── Highlighted Notes Panel (tersembunyi saat Mode Baca aktif) ─── */}
        {notesOpen && !readingMode && (
          <div
            style={{
              width: 320,
              minWidth: 260,
              maxWidth: 400,
              borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
              backgroundColor: isDark ? 'rgba(15,16,22,0.95)' : '#fff',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: isDark
                ? '-4px 0 24px rgba(0,0,0,0.4)'
                : '-4px 0 16px rgba(0,0,0,0.03)',
              zIndex: 10,
              animation: 'ca-slide-in 0.3s cubic-bezier(0, 0, 0.2, 1)',
            }}
          >
            <style>{`
              @keyframes ca-slide-in {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
              }
            `}</style>
            {/* Panel header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9'}`,
                flexShrink: 0,
                background: isDark
                  ? 'linear-gradient(to bottom, rgba(255,255,255,0.02), transparent)'
                  : 'linear-gradient(to bottom, #fcfcfd, #fff)',
              }}
            >
              <Group gap={8}>
                <IconBook size={16} color={theme.colors.blue[6]} />
                <Text
                  fw={800}
                  size="xs"
                  style={{
                    letterSpacing: '0.05em',
                    color: isDark ? '#e2e8f0' : '#1e293b',
                    textTransform: 'uppercase',
                  }}
                >
                  Anotasi Artikel
                </Text>
              </Group>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => setNotesOpen(false)}
                title="Tutup panel"
              >
                <IconChevronRight size={16} />
              </ActionIcon>
            </div>

            {/* Panel content */}
            <ScrollArea style={{ flex: 1 }}>
              <div style={{ padding: '16px' }}>
                {isLoadingAnnotations ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '3rem 1rem',
                      gap: 12,
                    }}
                  >
                    <Loader size="sm" color="blue" />
                    <Text size="xs" c="dimmed" fw={600}>
                      MEMUAT CATATAN...
                    </Text>
                  </div>
                ) : (
                  <Stack gap="md">
                    {highlights.length === 0 ? (
                      <Box
                        style={{ textAlign: 'center', padding: '3rem 1rem' }}
                      >
                        <IconBookOff
                          size={40}
                          color={isDark ? '#334155' : '#e2e8f0'}
                          stroke={1.5}
                          style={{ marginBottom: 12 }}
                        />
                        <Text c="dimmed" size="xs" fw={500}>
                          Belum ada highlight pada artikel ini.
                        </Text>
                      </Box>
                    ) : (
                      highlights.map((h, idx) => {
                        const text =
                          typeof h.content === 'string'
                            ? h.content
                            : h.content?.text || '';
                        return (
                          <Card
                            key={h.id}
                            padding="sm"
                            radius="md"
                            withBorder
                            style={{
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              backgroundColor: isDark
                                ? 'rgba(255,255,255,0.03)'
                                : '#fcfcfd',
                              borderColor: isDark
                                ? 'rgba(255,255,255,0.08)'
                                : '#eef2f6',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform =
                                'translateY(-2px)';
                              e.currentTarget.style.boxShadow =
                                '0 8px 20px rgba(0,0,0,0.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                            onClick={() => safeScrollTo(h)}
                          >
                            <Group justify="space-between" mb={8}>
                              <Box
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  backgroundColor: isDark
                                    ? 'rgba(59,130,246,0.15)'
                                    : '#dbeafe',
                                  color: isDark ? '#93c5fd' : '#1e40af',
                                  fontSize: 10,
                                  fontWeight: 800,
                                }}
                              >
                                HAL. {h.position.pageNumber}
                              </Box>
                              <ActionIcon
                                color="red"
                                variant="subtle"
                                size="xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteHighlight(h.id);
                                }}
                              >
                                <IconTrash size={14} />
                              </ActionIcon>
                            </Group>

                            {text && (
                              <Text
                                size="xs"
                                fw={500}
                                lineClamp={4}
                                mb={h.comment?.text ? 10 : 0}
                                style={{
                                  fontStyle: 'italic',
                                  color: isDark ? '#cbd5e1' : '#475569',
                                  borderLeft: `2px solid ${theme.colors.blue[4]}`,
                                  paddingLeft: 10,
                                  lineHeight: 1.5,
                                }}
                              >
                                "{text}"
                              </Text>
                            )}

                            {h.comment?.text && (
                              <Box
                                p="xs"
                                style={{
                                  backgroundColor: isDark
                                    ? 'rgba(0,0,0,0.2)'
                                    : 'rgba(255,255,255,0.8)',
                                  borderRadius: 6,
                                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e5e7eb'}`,
                                }}
                              >
                                <Text
                                  size="xs"
                                  fw={600}
                                  style={{
                                    color: isDark ? '#e2e8f0' : '#1e293b',
                                  }}
                                >
                                  {h.comment.text
                                    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
                                    .trim()}
                                </Text>
                              </Box>
                            )}
                          </Card>
                        );
                      })
                    )}
                  </Stack>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Toggle button when notes closed — tidak tampil saat Mode Baca */}
        {!notesOpen && !readingMode && (
          <Tooltip label="Buka Panel Catatan" position="left" withArrow>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                backgroundColor: isDark ? 'rgba(15,16,22,0.9)' : '#f8fafc',
                borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
                cursor: 'pointer',
                gap: 8,
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = isDark
                  ? '#1e293b'
                  : '#f1f5f9')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = isDark
                  ? 'rgba(15,16,22,0.9)'
                  : '#f8fafc')
              }
              onClick={() => setNotesOpen(true)}
            >
              <ActionIcon variant="subtle" color="blue" size="sm">
                <IconChevronLeft size={16} />
              </ActionIcon>
              <Text
                size="xs"
                fw={800}
                style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  transform: 'rotate(180deg)',
                  letterSpacing: '0.1em',
                  color: isDark ? '#94a3b8' : '#64748b',
                  userSelect: 'none',
                  textTransform: 'uppercase',
                  fontSize: 9,
                }}
              >
                Tampilkan Catatan
              </Text>
            </div>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

export default WebViewer;

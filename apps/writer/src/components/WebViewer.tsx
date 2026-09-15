/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  PdfLoader,
  PdfHighlighter,
  Highlight,
  Tip,
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
} from '@mantine/core';

// Apply native DOM textLayer highlighting
const applyDOMHighlights = (textLayer: any, highlights: any) => {
  if (!highlights || highlights.length === 0) return;

  // Clear old highlights first to avoid double wrapping on re-renders
  const existingMarks = textLayer.querySelectorAll('mark.highlight');
  existingMarks.forEach((mark: any) => {
    const parent = mark.parentNode;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  });

  highlights.forEach((highlight: any) => {
    const textToFind =
      typeof highlight.content === 'string' ? highlight.content : highlight.content?.text || '';
    if (!textToFind.trim()) return;
    const walker = document.createTreeWalker(
      textLayer,
      NodeFilter.SHOW_TEXT,
      null
    );
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }
    let fullText = textNodes.map((n) => n.nodeValue).join('');
    let startIndex = fullText.indexOf(textToFind);
    if (startIndex === -1)
      startIndex = fullText.toLowerCase().indexOf(textToFind.toLowerCase());
    if (startIndex === -1) return;
    let endIndex = startIndex + textToFind.length;

    let currentIndex = 0;
    let startNodeInfo = null;
    let endNodeInfo = null;

    for (let i = 0; i < textNodes.length; i++) {
      const tNode = textNodes[i];
      const nodeLength = tNode.nodeValue?.length || 0;
      if (
        !startNodeInfo &&
        startIndex >= currentIndex &&
        startIndex < currentIndex + nodeLength
      ) {
        startNodeInfo = {
          node: tNode,
          offset: startIndex - currentIndex,
          index: i,
        };
      }
      if (
        !endNodeInfo &&
        endIndex > currentIndex &&
        endIndex <= currentIndex + nodeLength
      ) {
        endNodeInfo = {
          node: tNode,
          offset: endIndex - currentIndex,
          index: i,
        };
      }
      currentIndex += nodeLength;
      if (startNodeInfo && endNodeInfo) break;
    }

    if (startNodeInfo && endNodeInfo) {
      for (let i = startNodeInfo.index; i <= endNodeInfo.index; i++) {
        const tNode = textNodes[i];
        let start = 0;
        let end = tNode.nodeValue?.length || 0;
        if (i === startNodeInfo.index) start = startNodeInfo.offset;
        if (i === endNodeInfo.index) end = endNodeInfo.offset;
        if (start < end) {
          try {
            const range = document.createRange();
            range.setStart(tNode, start);
            range.setEnd(tNode, end);
            const mark = document.createElement('mark');
            mark.className = 'highlight';
            mark.dataset.id = highlight.id;
            // The user's requested style
            mark.style.background = 'rgba(255, 230, 0, 0.45)';
            mark.style.borderRadius = '2px';
            mark.style.color = 'inherit';
            range.surroundContents(mark);
          } catch (e) {}
        }
      }
    }
  });
};

// Removed applyDOMHighlights since we will rely on native react-pdf-highlighter overlays that are zoom-aware.

import 'react-pdf-highlighter/dist/style.css';

interface WebViewerProps {
  fileUrl: string;
  onAnalytics?: (data: any) => void;
}

const WebViewer: React.FC<WebViewerProps> = ({ fileUrl, onAnalytics }) => {
  const [highlights, setHighlights] = useState<IHighlight[]>([]);
  const scrollViewerTo = useRef<(highlight: IHighlight) => void>(() => {});
  const highlighterRef = useRef<any>(null);
  const [pdfScaleValue, setPdfScaleValue] = useState<string>('page-width');

  // Sync pdfScaleValue to PDF.js viewer
  useEffect(() => {
    if (highlighterRef.current?.viewer) {
      setTimeout(() => {
        if (highlighterRef.current?.viewer) {
          highlighterRef.current.viewer.currentScaleValue = pdfScaleValue;
        }
      }, 50);
    }
  }, [pdfScaleValue]);

  // Dark mode support
  const { colorScheme } = useMantineColorScheme();
  const theme = useMantineTheme();
  const isDark = colorScheme === 'dark';

  const parseIdFromHash = () =>
    document.location.hash.replace(/^#highlight-/, '');

  const resetHash = () => {
    document.location.hash = '';
  };

  const scrollToHighlightFromHash = useCallback(() => {
    const highlight = highlights.find((h) => h.id === parseIdFromHash());
    if (highlight) {
      scrollViewerTo.current(highlight);
    }
  }, [highlights]);

  useEffect(() => {
    window.addEventListener('hashchange', scrollToHighlightFromHash);
    return () => {
      window.removeEventListener('hashchange', scrollToHighlightFromHash);
    };
  }, [scrollToHighlightFromHash]);

  // Observe textLayer to apply DOM highlights
  useEffect(() => {
    if (!highlights.length) return;
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            const el = node as Element;
            if (el.classList && el.classList.contains('textLayer')) {
              setTimeout(() => applyDOMHighlights(el, highlights), 100);
            } else if (el.querySelectorAll) {
              const textLayers = el.querySelectorAll('.textLayer');
              textLayers.forEach((tl) =>
                setTimeout(() => applyDOMHighlights(tl, highlights), 100)
              );
            }
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    document
      .querySelectorAll('.textLayer')
      .forEach((tl) => applyDOMHighlights(tl, highlights));
    return () => observer.disconnect();
  }, [highlights]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Replace generic DOM event listener logic with cursor centered zoom logic
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (window.location.hash)
        window.history.replaceState(null, '', window.location.pathname);

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const prevScrollLeft = container.scrollLeft;
      const prevScrollTop = container.scrollTop;

      setPdfScaleValue((prev) => {
        let currentScale = 1.0;
        if (highlighterRef.current?.viewer?.currentScale) {
          currentScale = highlighterRef.current.viewer.currentScale;
        } else {
          const parsed = parseFloat(prev);
          currentScale = isNaN(parsed) ? 1.0 : parsed;
        }

        let newScale = currentScale;
        if (e.deltaY < 0) {
          newScale = Math.min(currentScale + 0.1, 3.0);
        } else {
          newScale = Math.max(currentScale - 0.1, 0.5);
        }

        if (newScale !== currentScale) {
          const scaleRatio = newScale / currentScale;

          // After a short delay (allowing the viewer to render the new scale), adjust scroll
          setTimeout(() => {
            if (containerRef.current) {
              containerRef.current.scrollLeft =
                (prevScrollLeft + mouseX) * scaleRatio - mouseX;
              containerRef.current.scrollTop =
                (prevScrollTop + mouseY) * scaleRatio - mouseY;
            }
          }, 10);
        }

        return String(newScale);
      });
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, {
        passive: false,
        capture: true,
      });
    }

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel, { capture: true });
      }
    };
  }, []);

  const addHighlight = (highlight: NewHighlight) => {
    const id = Math.random().toString(36).slice(2);
    const sanitizedComment = {
      text: highlight.comment?.text || '',
      emoji: highlight.comment?.emoji || '',
    };

    const newHighlight: IHighlight = {
      id,
      content: highlight.content,
      position: highlight.position,
      comment: sanitizedComment,
    };

    setHighlights((prev) => [newHighlight, ...prev]);

    const highlightedText =
      typeof highlight.content === 'string'
        ? highlight.content
        : highlight.content?.text || '';

    onAnalytics?.({
      action: 'annotation_add',
      document: fileUrl,
      metadata: {
        annotationType: 'Highlight',
        contents: sanitizedComment.text,
        highlightedText,
        pageNumber: newHighlight.position.pageNumber,
        rect: newHighlight.position.boundingRect,
        annotationId: newHighlight.id,
      },
      timeStamp: new Date().toISOString(),
    });
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

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileUrl.split('/').pop() || 'document.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onAnalytics?.({
      action: 'document_downloaded',
      document: fileUrl,
      timeStamp: new Date().toISOString(),
    });
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
        }}
      >
        {comment.emoji} {comment.text}
      </div>
    ) : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: isDark ? theme.colors.dark[7] : theme.colors.gray[0],
        color: isDark ? theme.colors.gray[0] : theme.colors.dark[7],
      }}
    >
      <style>{`
        /* ✅ Fix highlight color and blend mode for native overlays */
        div[class*="part_"],
        .Highlight__part {
          background-color: rgba(255, 230, 0, 0.45) !important;
          mix-blend-mode: multiply !important;
          pointer-events: auto !important;
        }

        div[class*="areaHighlight_"],
        .AreaHighlight {
          background-color: rgba(255, 226, 143, 0.3) !important;
          border: 2px solid rgba(255, 226, 143, 0.8) !important;
          mix-blend-mode: normal !important;
          z-index: 10 !important;
          pointer-events: auto !important;
        }
      `}</style>
      <Group
        justify="end"
        p="sm"
        style={{
          backgroundColor: isDark ? theme.colors.dark[6] : theme.colors.gray[1],
          borderBottom: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
        }}
      >
        <Button
          onClick={handleDownload}
          variant="light"
          size="xs"
          color={isDark ? 'blue' : 'blue'}
        >
          Download PDF
        </Button>
      </Group>

      <div style={{ display: 'flex', height: '100%' }}>
        {/* Kiri: PDF Viewer */}
        <div
          style={{
            flex: 3,
            position: 'relative',
            backgroundColor: isDark
              ? theme.colors.dark[8]
              : theme.colors.gray[0],
          }}
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
                Loading...
              </div>
            }
          >
            {(pdfDocument) => (
              <PdfHighlighter
                pdfDocument={pdfDocument}
                enableAreaSelection={(event) => event.altKey}
                scrollRef={(scrollTo) => {
                  scrollViewerTo.current = scrollTo;
                  scrollToHighlightFromHash();
                }}
                onScrollChange={resetHash}
                onSelectionFinished={(
                  position,
                  content,
                  hideTipAndSelection,
                  transformSelection
                ) => (
                  <Tip
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
                  if (isTextHighlight) return null;
                  const component = isTextHighlight ? null : (
                    <AreaHighlight
                      isScrolledTo={isScrolledTo}
                      highlight={highlight}
                      onChange={(boundingRect) => {
                        updateHighlight(
                          highlight.id,
                          viewportToScaled(boundingRect),
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
                      key={highlight.id || String(index)}
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

        <div
          style={{
            flex: 1,
            borderLeft: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
            backgroundColor: isDark
              ? theme.colors.dark[6]
              : theme.colors.gray[0],
            padding: '1rem',
            overflowY: 'auto',
          }}
        >
          <Title order={5} mb="sm" c={isDark ? 'gray.0' : 'dark.7'}>
            📌 Highlighted Notes
          </Title>
          <Divider
            mb="sm"
            color={isDark ? theme.colors.dark[4] : theme.colors.gray[3]}
          />

          <ScrollArea h="100%">
            <Stack>
              {highlights.length === 0 ? (
                <Text c="dimmed" size="sm">
                  Belum ada highlight.
                </Text>
              ) : (
                highlights.map((h) => {
                  const text =
                    typeof h.content === 'string'
                      ? h.content
                      : h.content?.text || '';

                  return (
                    <Card
                      key={h.id}
                      withBorder
                      radius="md"
                      shadow="sm"
                      onClick={() => scrollViewerTo.current(h)}
                      style={{
                        cursor: 'pointer',
                        transition: '0.2s',
                        backgroundColor: isDark
                          ? theme.colors.dark[5]
                          : theme.colors.gray[0],
                        borderColor: isDark
                          ? theme.colors.dark[4]
                          : theme.colors.gray[3],
                      }}
                      mih={80}
                    >
                      <Text size="xs" c="dimmed" mb={4}>
                        📄 Page {h.position.pageNumber}
                      </Text>

                      {text && (
                        <Text
                          size="sm"
                          fw={500}
                          lineClamp={3}
                          mb={4}
                          c={isDark ? 'gray.0' : 'dark.7'}
                        >
                          {text}
                        </Text>
                      )}

                      {h.comment?.text && (
                        <Text size="sm" c={isDark ? 'gray.3' : 'gray.7'}>
                          💬 {h.comment.emoji} {h.comment.text}
                        </Text>
                      )}
                    </Card>
                  );
                })
              )}
            </Stack>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};

export default WebViewer;

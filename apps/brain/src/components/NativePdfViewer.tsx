'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// Ensure worker is loaded. For Next.js, we can use the local file or CDN.
// Based on next.config.ts, the worker is loaded as an asset, but we can also use CDN.
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface HighlightData {
  id: string;
  page: number;
  highlightedText: string;
  comment?: string;
  positionData?: unknown;
}

interface NativePdfViewerProps {
  fileUrl: string;
  scale: number;
  highlights: HighlightData[];
  onHighlightSelected: (
    pageNumber: number,
    text: string,
    range: Range,
    rect: DOMRect
  ) => void;
  onScrollTo?: string; // highlight id to scroll to
}

export const NativePdfViewer: React.FC<NativePdfViewerProps> = ({
  fileUrl,
  scale,
  highlights,
  onHighlightSelected,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);

  useEffect(() => {
    let active = true;
    pdfjsLib
      .getDocument(fileUrl)
      .promise.then((doc) => {
        if (!active) return;
        setPdf(doc);
        setNumPages(doc.numPages);
      })
      .catch((err) => {
        console.error('Failed to load PDF', err);
      });
    return () => {
      active = false;
    };
  }, [fileUrl]);

  const handleSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const text = selection.toString().trim();
    if (!text) return;

    // Find page number
    let node = range.startContainer as Node | null;
    let pageNum = -1;
    while (node && node !== document.body) {
      if ((node as HTMLElement).classList?.contains('pdf-page')) {
        pageNum = parseInt(
          (node as HTMLElement).dataset.pageNumber || '-1',
          10
        );
        break;
      }
      node = node.parentNode;
    }

    if (pageNum !== -1) {
      const rect = range.getBoundingClientRect();
      onHighlightSelected(pageNum, text, range, rect);
    }
  }, [onHighlightSelected]);

  useEffect(() => {
    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
  }, [handleSelection]);

  if (!pdf) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
        }}
      >
        Loading PDF...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        overflowY: 'auto',
        position: 'relative',
        backgroundColor: '#f5f5f5',
      }}
      className="native-pdf-viewer"
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '20px 0',
        }}
      >
        {Array.from({ length: numPages }).map((_, i) => (
          <PdfPage
            key={i}
            pdf={pdf}
            pageNumber={i + 1}
            scale={scale}
            pageHighlights={highlights.filter((h) => h.page === i + 1)}
          />
        ))}
      </div>
    </div>
  );
};

const PdfPage = ({
  pdf,
  pageNumber,
  scale,
  pageHighlights,
}: {
  pdf: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  pageHighlights: HighlightData[];
}) => {
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let renderTask: { promise: Promise<void>; cancel: () => void } | undefined;
    let textLayerRenderTask:
      | { promise: Promise<void>; cancel: () => void }
      | undefined;
    let active = true;

    pdf
      .getPage(pageNumber)
      .then((page) => {
        if (!active) return;
        const viewport = page.getViewport({ scale });

        if (pageRef.current) {
          pageRef.current.style.width = `${viewport.width}px`;
          pageRef.current.style.height = `${viewport.height}px`;
        }

        const canvas = canvasRef.current;
        if (canvas) {
          const context = canvas.getContext('2d');
          if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            renderTask = page.render({ canvasContext: context, viewport });
            renderTask.promise
              .then(() => {
                if (!active) return;
                page
                  .getTextContent()
                  .then((textContent) => {
                    if (!active) return;
                    if (textLayerRef.current) {
                      textLayerRef.current.innerHTML = '';
                      textLayerRenderTask = pdfjsLib.renderTextLayer({
                        textContentSource: textContent,
                        container: textLayerRef.current,
                        viewport,
                        textDivs: [],
                      });

                      textLayerRenderTask.promise
                        .then(() => {
                          if (!active) return;
                          applyHighlightsToDOM(
                            textLayerRef.current!,
                            pageHighlights
                          );
                        })
                        .catch(() => {});
                    }
                  })
                  .catch(() => {});
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => {});

    return () => {
      active = false;
      if (renderTask) renderTask.cancel();
      if (textLayerRenderTask) textLayerRenderTask.cancel();
    };
  }, [pdf, pageNumber, scale, pageHighlights]);

  const applyHighlightsToDOM = (
    container: HTMLElement,
    highlights: HighlightData[]
  ) => {
    if (!highlights || highlights.length === 0) return;

    highlights.forEach((highlight) => {
      const textToFind = highlight.highlightedText.trim();
      if (!textToFind) return;

      const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null
      );
      const textNodes: Node[] = [];
      let node;
      while ((node = walker.nextNode())) {
        textNodes.push(node);
      }

      let fullText = '';
      textNodes.forEach((n) => (fullText += n.nodeValue));

      let startIndex = fullText.indexOf(textToFind);
      if (startIndex === -1) {
        // try case insensitive
        startIndex = fullText.toLowerCase().indexOf(textToFind.toLowerCase());
      }
      if (startIndex === -1) return;

      let endIndex = startIndex + textToFind.length;

      // Find the start and end text nodes
      let currentIndex = 0;
      let startNodeInfo: { node: Node; offset: number; index: number } | null =
        null;
      let endNodeInfo: { node: Node; offset: number; index: number } | null =
        null;

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
        const range = document.createRange();
        range.setStart(startNodeInfo.node, startNodeInfo.offset);
        range.setEnd(endNodeInfo.node, endNodeInfo.offset);

        // create custom highlight if CSS custom highlights are supported, otherwise wrap in <span class="highlight">
        // since we want native DOM spans:
        try {
          const mark = document.createElement('mark');
          mark.className = 'highlight';
          mark.dataset.highlightId = highlight.id;
          mark.style.background = 'rgba(255, 230, 0, 0.45)';
          mark.style.borderRadius = '2px';
          mark.style.color = 'inherit';
          range.surroundContents(mark);
        } catch (e) {
          // If range spans multiple nodes, surroundContents fails.
          // Fallback: manually wrap each text node in the range.
          for (let i = startNodeInfo.index; i <= endNodeInfo.index; i++) {
            const tNode = textNodes[i];
            let start = 0;
            let end = tNode.nodeValue?.length || 0;
            if (i === startNodeInfo.index) start = startNodeInfo.offset;
            if (i === endNodeInfo.index) end = endNodeInfo.offset;

            if (start < end) {
              const r = document.createRange();
              r.setStart(tNode, start);
              r.setEnd(tNode, end);
              const mark = document.createElement('mark');
              mark.className = 'highlight';
              mark.style.background = 'rgba(255, 230, 0, 0.45)';
              mark.style.borderRadius = '2px';
              mark.style.color = 'inherit';
              try {
                r.surroundContents(mark);
              } catch (e) {}
            }
          }
        }
      }
    });
  };

  return (
    <div
      className="pdf-page"
      data-page-number={pageNumber}
      ref={pageRef}
      style={{
        position: 'relative',
        margin: '10px auto',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        backgroundColor: 'white',
      }}
    >
      <canvas
        className="pdf-canvas"
        ref={canvasRef}
        style={{ display: 'block' }}
      />
      <div
        className="textLayer"
        ref={textLayerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          opacity: 1, // Let text be selectable
          lineHeight: 1.0,
          color: 'transparent', // native pdfjs makes text transparent but selectable
        }}
      />
      <div
        className="annotationLayer"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

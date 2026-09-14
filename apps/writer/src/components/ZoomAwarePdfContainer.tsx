/**
 * Enhanced PDF Viewer dengan Zoom-Aware Highlights
 *
 * Mengatasi masalah highlight yang meleset saat zoom in/out
 * dengan menggunakan CSS transform dan koordinat normalisasi
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { IHighlight } from 'react-pdf-highlighter';

interface ZoomAwarePdfContainerProps {
  children: React.ReactNode;
  highlights: IHighlight[];
  onZoomChange?: (zoom: number) => void;
  onHighlightsUpdate?: (highlights: IHighlight[]) => void;
}

/**
 * Container yang menangani zoom dengan CSS transform
 * Ini memastikan highlights tetap akurat karena mereka juga ter-scale dengan parent
 */
export const ZoomAwarePdfContainer: React.FC<ZoomAwarePdfContainerProps> = ({
  children,
  highlights,
  onZoomChange,
  onHighlightsUpdate,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [baseWidth, setBaseWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  // Detect zoom via CSS transform pada halaman
  useEffect(() => {
    const detectZoom = () => {
      if (!containerRef.current) return;

      // Cek zoom level dari parent element atau menggunakan window.devicePixelRatio
      const style = window.getComputedStyle(containerRef.current);
      const transform = style.transform;

      let detectedZoom = 1;
      if (transform && transform !== 'none') {
        const match = transform.match(/scale\(([\d.]+)\)/);
        if (match) {
          detectedZoom = parseFloat(match[1]);
        }
      }

      if (detectedZoom !== zoomLevel) {
        setZoomLevel(detectedZoom);
        onZoomChange?.(detectedZoom);
      }
    };

    // Setup ResizeObserver
    if (!observerRef.current && containerRef.current) {
      observerRef.current = new ResizeObserver(() => {
        detectZoom();
      });
      observerRef.current.observe(containerRef.current);
    }

    // Polling untuk detect perubahan zoom
    const interval = setInterval(detectZoom, 200);

    return () => {
      clearInterval(interval);
    };
  }, [zoomLevel, onZoomChange]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        transformOrigin: 'top left',
        transition: 'transform 0.1s ease-out',
      }}
    >
      {children}
    </div>
  );
};

/**
 * Hook untuk menangani keyboard zoom shortcuts (Ctrl+, Ctrl-, Ctrl+0)
 */
export function useKeyboardZoom(containerSelector: string, initialZoom = 1) {
  const [zoom, setZoom] = useState(initialZoom);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = document.querySelector(containerSelector);
    if (container && container instanceof HTMLElement) {
      containerRef.current = container;
    }
  }, [containerSelector]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current) return;

      // Ctrl/Cmd + Plus/Equals = Zoom In
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        setZoom((prev) => Math.min(prev + 0.1, 3));
      }
      // Ctrl/Cmd + Minus = Zoom Out
      else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        setZoom((prev) => Math.max(prev - 0.1, 0.5));
      }
      // Ctrl/Cmd + 0 = Reset Zoom
      else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setZoom(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Apply zoom transform ke container
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.transform = `scale(${zoom})`;
    }
  }, [zoom]);

  return {
    zoom,
    setZoom,
  };
}

/**
 * Menyimpan highlight dengan metadata zoom dan viewport
 * Berguna untuk akurasi saat highlight di-load kembali
 */
export interface HighlightWithMetadata extends IHighlight {
  metadata?: {
    zoomLevel: number;
    viewportWidth: number;
    viewportHeight: number;
    createdAt: string;
  };
}

/**
 * Normalisasi highlight ketika disimpan
 * Menyimpan zoom dan viewport info untuk akurasi di masa depan
 */
export function normalizeHighlightForStorage(
  highlight: IHighlight,
  currentZoom: number,
  viewportWidth: number,
  viewportHeight: number
): HighlightWithMetadata {
  return {
    ...highlight,
    metadata: {
      zoomLevel: currentZoom,
      viewportWidth,
      viewportHeight,
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Denormalisasi highlight ketika dimuat
 * Menyesuaikan koordinat berdasarkan viewport saat ini
 */
export function denormalizeHighlightFromStorage(
  highlight: HighlightWithMetadata,
  currentViewportWidth: number,
  currentViewportHeight: number
): IHighlight {
  if (!highlight.metadata) {
    return highlight;
  }

  const { viewportWidth: savedWidth, viewportHeight: savedHeight } =
    highlight.metadata;

  // Hitung scale factor
  const scaleX = currentViewportWidth / savedWidth;
  const scaleY = currentViewportHeight / savedHeight;

  // Transform position coordinates
  const scaledPosition = {
    ...highlight.position,
    boundingRect: {
      ...highlight.position.boundingRect,
      x1: highlight.position.boundingRect.x1 * scaleX,
      y1: highlight.position.boundingRect.y1 * scaleY,
      x2: highlight.position.boundingRect.x2 * scaleX,
      y2: highlight.position.boundingRect.y2 * scaleY,
    },
    rects: highlight.position.rects.map((rect) => ({
      x1: rect.x1 * scaleX,
      y1: rect.y1 * scaleY,
      x2: rect.x2 * scaleX,
      y2: rect.y2 * scaleY,
      width: rect.width * scaleX,
      height: rect.height * scaleY,
    })),
  };

  return {
    ...highlight,
    position: scaledPosition,
  };
}

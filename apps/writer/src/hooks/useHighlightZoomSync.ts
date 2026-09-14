/**
 * Custom Hook: useHighlightZoomSync
 * Synchronizes highlights dengan zoom level perubahan
 * Memastikan highlight tetap tepat pada teks saat zoom in/out
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { IHighlight } from 'react-pdf-highlighter';
import {
  ZoomObserver,
  transformHighlightsOnZoom,
  type ZoomState,
} from '@/lib/highlightZoomHandler';

interface UseHighlightZoomSyncProps {
  highlights: IHighlight[];
  onHighlightsUpdate: (highlights: IHighlight[]) => void;
  containerSelector: string;
  enabled?: boolean;
}

export function useHighlightZoomSync({
  highlights,
  onHighlightsUpdate,
  containerSelector,
  enabled = true,
}: UseHighlightZoomSyncProps) {
  const zoomObserverRef = useRef<ZoomObserver | null>(null);
  const [currentZoom, setCurrentZoom] = useState(1);
  const highlightsRef = useRef(highlights);

  // Update ref saat highlights berubah
  useEffect(() => {
    highlightsRef.current = highlights;
  }, [highlights]);

  useEffect(() => {
    if (!enabled) return;

    // Initialize zoom observer
    const observer = new ZoomObserver(containerSelector);
    zoomObserverRef.current = observer;

    // Callback saat zoom berubah
    const handleZoomChange = (zoomState: ZoomState) => {
      setCurrentZoom(zoomState.currentScale);

      // Transform highlights dengan zoom ratio baru
      const transformedHighlights = transformHighlightsOnZoom(
        highlightsRef.current,
        zoomState
      );

      // Update highlights di parent component
      onHighlightsUpdate(transformedHighlights);
    };

    // Start observing
    observer.start(handleZoomChange);

    // Cleanup
    return () => {
      observer.stop();
    };
  }, [enabled, containerSelector, onHighlightsUpdate]);

  return {
    currentZoom,
    zoomObserver: zoomObserverRef.current,
  };
}

/**
 * Simpler hook untuk hanya tracking zoom level tanpa transform
 */
export function useZoomLevel(containerSelector: string) {
  const zoomObserverRef = useRef<ZoomObserver | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    const observer = new ZoomObserver(containerSelector);
    zoomObserverRef.current = observer;

    observer.start((zoomState) => {
      setZoomLevel(zoomState.currentScale);
    });

    return () => {
      observer.stop();
    };
  }, [containerSelector]);

  return zoomLevel;
}

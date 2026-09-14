/**
 * Highlight Zoom Handler
 * Menangani transformasi koordinat highlight saat zoom PDF berubah
 * Memastikan highlight tetap melekat pada text yang benar setelah zoom
 */

import type { IHighlight, ScaledPosition } from 'react-pdf-highlighter';

interface ViewportDimensions {
  width: number;
  height: number;
}

export interface ZoomState {
  currentScale: number;
  previousScale: number;
  viewportDimensions: ViewportDimensions;
}

/**
 * Transform koordinat highlight dari satu zoom level ke level lain
 * @param position - Posisi highlight asli
 * @param currentZoom - Zoom level saat ini
 * @param previousZoom - Zoom level sebelumnya
 * @returns Posisi yang sudah di-transform
 */
export function transformHighlightPositionOnZoom(
  position: ScaledPosition,
  currentZoom: number,
  previousZoom: number
): ScaledPosition {
  if (currentZoom === previousZoom) return position;

  // Hitung scale factor
  const zoomRatio = currentZoom / previousZoom;

  // Transform bounding rect
  const transformedBoundingRect = {
    ...position.boundingRect,
    x1: position.boundingRect.x1 * zoomRatio,
    y1: position.boundingRect.y1 * zoomRatio,
    x2: position.boundingRect.x2 * zoomRatio,
    y2: position.boundingRect.y2 * zoomRatio,
  };

  // Transform individual rects
  const transformedRects = position.rects.map((rect) => ({
    x1: rect.x1 * zoomRatio,
    y1: rect.y1 * zoomRatio,
    x2: rect.x2 * zoomRatio,
    y2: rect.y2 * zoomRatio,
    width: rect.width * zoomRatio,
    height: rect.height * zoomRatio,
  }));

  return {
    ...position,
    boundingRect: transformedBoundingRect,
    rects: transformedRects,
  };
}

/**
 * Normalisasi koordinat highlight ke PDF absolute space
 * Ini diperlukan untuk export PDF yang akurat
 * @param position - Posisi highlight dalam viewport-relative space
 * @param viewportDimensions - Dimensi viewport saat highlight dibuat
 * @param pdfPageDimensions - Dimensi halaman PDF aktual
 * @returns Posisi dalam PDF absolute space
 */
export function normalizeHighlightToPDFSpace(
  position: ScaledPosition,
  viewportDimensions: ViewportDimensions,
  pdfPageDimensions: { width: number; height: number }
): ScaledPosition {
  // Hitung scaling factor dari viewport ke PDF
  const scaleX = pdfPageDimensions.width / viewportDimensions.width;
  const scaleY = pdfPageDimensions.height / viewportDimensions.height;

  const normalizedBoundingRect = {
    ...position.boundingRect,
    x1: position.boundingRect.x1 * scaleX,
    y1: position.boundingRect.y1 * scaleY,
    x2: position.boundingRect.x2 * scaleX,
    y2: position.boundingRect.y2 * scaleY,
  };

  const normalizedRects = position.rects.map((rect) => ({
    x1: rect.x1 * scaleX,
    y1: rect.y1 * scaleY,
    x2: rect.x2 * scaleX,
    y2: rect.y2 * scaleY,
    width: rect.width * scaleX,
    height: rect.height * scaleY,
  }));

  return {
    ...position,
    boundingRect: normalizedBoundingRect,
    rects: normalizedRects,
  };
}

/**
 * Transform koordinat dari PDF absolute space ke viewport space
 * Berguna untuk loading highlight dari database
 * @param position - Posisi dalam PDF absolute space
 * @param viewportDimensions - Dimensi viewport target
 * @param pdfPageDimensions - Dimensi halaman PDF
 * @returns Posisi dalam viewport-relative space
 */
export function denormalizeHighlightFromPDFSpace(
  position: ScaledPosition,
  viewportDimensions: ViewportDimensions,
  pdfPageDimensions: { width: number; height: number }
): ScaledPosition {
  // Hitung scaling factor dari PDF ke viewport
  const scaleX = viewportDimensions.width / pdfPageDimensions.width;
  const scaleY = viewportDimensions.height / pdfPageDimensions.height;

  const denormalizedBoundingRect = {
    ...position.boundingRect,
    x1: position.boundingRect.x1 * scaleX,
    y1: position.boundingRect.y1 * scaleY,
    x2: position.boundingRect.x2 * scaleX,
    y2: position.boundingRect.y2 * scaleY,
  };

  const denormalizedRects = position.rects.map((rect) => ({
    x1: rect.x1 * scaleX,
    y1: rect.y1 * scaleY,
    x2: rect.x2 * scaleX,
    y2: rect.y2 * scaleY,
    width: rect.width * scaleX,
    height: rect.height * scaleY,
  }));

  return {
    ...position,
    boundingRect: denormalizedBoundingRect,
    rects: denormalizedRects,
  };
}

/**
 * Observer untuk mendeteksi perubahan zoom level
 * Menggunakan ResizeObserver dan polling untuk akurasi maksimal
 */
export class ZoomObserver {
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private lastScale: number = 1;
  private onZoomChange: ((zoomState: ZoomState) => void) | null = null;

  constructor(containerSelector: string) {
    const element = document.querySelector(containerSelector);
    if (element && element instanceof HTMLElement) {
      this.container = element;
    }
  }

  /**
   * Mulai observe perubahan zoom
   */
  start(callback: (zoomState: ZoomState) => void): void {
    if (!this.container) {
      console.warn('Container not found for ZoomObserver');
      return;
    }

    this.onZoomChange = callback;

    // Gunakan ResizeObserver untuk detect perubahan ukuran container
    this.resizeObserver = new ResizeObserver(() => {
      this.checkZoomLevel();
    });
    this.resizeObserver.observe(this.container);

    // Polling juga untuk menangkap perubahan zoom yang cepat
    this.pollInterval = setInterval(() => {
      this.checkZoomLevel();
    }, 200);

    // Initial check
    this.checkZoomLevel();
  }

  /**
   * Stop observing
   */
  stop(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  /**
   * Cek apakah zoom level berubah
   */
  private checkZoomLevel(): void {
    if (!this.container) return;

    const computedStyle = window.getComputedStyle(this.container);
    const transform = computedStyle.transform;

    // Parse scale dari CSS transform
    let currentScale = 1;
    if (transform && transform !== 'none') {
      const match = transform.match(/scale\(([^)]+)\)/);
      if (match && match[1]) {
        const values = match[1].split(',');
        currentScale = parseFloat(values[0]) || 1;
      }
    }

    // Jika zoom berubah, trigger callback
    if (currentScale !== this.lastScale) {
      const previousScale = this.lastScale;
      this.lastScale = currentScale;

      this.onZoomChange?.({
        currentScale,
        previousScale,
        viewportDimensions: {
          width: this.container.offsetWidth,
          height: this.container.offsetHeight,
        },
      });
    }
  }

  /**
   * Get current zoom level
   */
  getCurrentScale(): number {
    return this.lastScale;
  }

  /**
   * Manually set zoom level (jika zoom dilakukan via API)
   */
  setCurrentScale(scale: number): void {
    if (scale !== this.lastScale) {
      const previousScale = this.lastScale;
      this.lastScale = scale;

      this.onZoomChange?.({
        currentScale: scale,
        previousScale,
        viewportDimensions: {
          width: this.container?.offsetWidth || 0,
          height: this.container?.offsetHeight || 0,
        },
      });
    }
  }
}

/**
 * Batch transform highlights saat zoom terjadi
 */
export function transformHighlightsOnZoom(
  highlights: IHighlight[],
  zoomState: ZoomState
): IHighlight[] {
  return highlights.map((highlight) => ({
    ...highlight,
    position: transformHighlightPositionOnZoom(
      highlight.position,
      zoomState.currentScale,
      zoomState.previousScale
    ),
  }));
}

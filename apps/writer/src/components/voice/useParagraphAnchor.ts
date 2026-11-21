import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

/** Where the floating voice dock sits: next to a paragraph, or the bottom-center fallback. */
export type DockPosition = { kind: "anchored"; top: number; left: number } | { kind: "bottom" };

/** The draft editor's root (PlateContent renders a Slate editable with this class). */
export const EDITOR_SELECTOR = '.bn-editor[data-slate-editor="true"]';
const EDGE_GAP = 8; // dock's right edge to the editor's right edge (max)
const TEXT_GAP = 10; // end of the cursor's line to the dock
const MIN_TEXT_WIDTH = 160; // narrower editor than dock + this → bottom-center instead

/** The top-level block (direct child of the editor root) that contains `node`. */
function topLevelBlock(node: Node | null | undefined): HTMLElement | null {
  let element = node instanceof Element ? node : (node?.parentElement ?? null);
  const root = element?.closest<HTMLElement>(EDITOR_SELECTOR);
  if (!element || !root) return null;
  while (element.parentElement && element.parentElement !== root) element = element.parentElement;
  return element.parentElement === root ? (element as HTMLElement) : null;
}

/** Nearest ancestor that scrolls vertically (the editor scrolls inside its panel). */
function scrollParent(element: HTMLElement): HTMLElement | null {
  for (let el = element.parentElement; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) return el;
  }
  return null;
}

/**
 * Keeps the voice dock right after the text of the line that holds the
 * cursor (at the editor's right edge when that line is full, covering its
 * end). Clicking the dock keeps the last line (the editor loses focus, the
 * anchor stays).
 *
 * Falls back to bottom-center when no paragraph has been clicked yet, the
 * paragraph is scrolled out of view, or the editor is too narrow.
 * While `frozen` (recording) the dock stays exactly where it is.
 */
export function useParagraphAnchor(dockRef: RefObject<HTMLElement | null>, frozen: boolean): DockPosition {
  const [position, setPosition] = useState<DockPosition>({ kind: "bottom" });
  const blockRef = useRef<HTMLElement | null>(null);
  /** Cursor line's middle, relative to the block's top (kept when focus leaves the editor). */
  const lineOffsetRef = useRef<number | null>(null);
  const caretXRef = useRef<number | null>(null);
  const frameRef = useRef(0);
  const frozenRef = useRef(frozen);

  useLayoutEffect(() => {
    frozenRef.current = frozen;
  }, [frozen]);

  const measure = useCallback(() => {
    if (frozenRef.current) return;
    const block = blockRef.current;
    const dock = dockRef.current;
    const root = block?.parentElement;
    const toBottom = () => setPosition(prev => (prev.kind === "bottom" ? prev : { kind: "bottom" }));
    if (!block || !dock || !root || !block.isConnected) return toBottom();

    const rootRect = root.getBoundingClientRect();
    // Measured from the controls row: the dock may still have the bottom-center
    // layout (with the status part) right now.
    const controls = dock.firstElementChild as HTMLElement | null;
    const dockWidth = (controls?.offsetWidth ?? dock.offsetWidth) + 14;
    const dockHeight = (controls?.offsetHeight ?? dock.offsetHeight) + 12;
    if (rootRect.width < dockWidth + MIN_TEXT_WIDTH) return toBottom();

    // The line the cursor is on: while the selection is in this block, read
    // it from the caret; otherwise reuse the last known line (e.g. the dock
    // was clicked). Falls back to the block's first line.
    const blockRect = block.getBoundingClientRect();
    const selection = window.getSelection();
    if (selection?.rangeCount && block.contains(selection.anchorNode)) {
      const caret = selection.getRangeAt(0).cloneRange();
      caret.collapse(true);
      const caretRect = Array.from(caret.getClientRects()).find(rect => rect.height > 0);
      if (caretRect) {
        lineOffsetRef.current = caretRect.top + caretRect.height / 2 - blockRect.top;
        caretXRef.current = caretRect.left - blockRect.left;
      }
    }
    // Only the boxes of the text itself: element boxes (the paragraph, the
    // full-width placeholder span) span the whole editor width.
    const boxes: DOMRect[] = [];
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (!text.textContent?.replace(/[​﻿]/g, "").trim()) continue; // Slate's zero-width fillers
      range.selectNodeContents(text);
      for (const rect of Array.from(range.getClientRects())) if (rect.width > 0 && rect.height > 0) boxes.push(rect);
    }
    const lineY = lineOffsetRef.current === null ? null : blockRect.top + lineOffsetRef.current;
    const onLine = (y: number) => boxes.filter(rect => rect.top <= y && rect.bottom >= y);
    const sameLine = lineY !== null ? onLine(lineY) : boxes.length ? onLine(boxes[0].top + boxes[0].height / 2) : [];
    // Empty line without text: the caret itself (or the block's left edge).
    const caretX = caretXRef.current === null ? blockRect.left : blockRect.left + caretXRef.current;
    const lineTop = sameLine.length ? Math.min(...sameLine.map(rect => rect.top)) : lineY !== null ? lineY - 10 : blockRect.top;
    const lineBottom = sameLine.length ? Math.max(...sameLine.map(rect => rect.bottom)) : lineY !== null ? lineY + 10 : blockRect.bottom;
    const lineRight = sameLine.length ? Math.max(...sameLine.map(rect => rect.right)) : caretX;
    const cursorLine = DOMRect.fromRect({ x: lineRight, y: lineTop, width: 0, height: lineBottom - lineTop });

    // Only while that line is inside the editor's visible (scrolled) area.
    const scroller = scrollParent(root);
    const area = scroller?.getBoundingClientRect();
    const visibleTop = Math.max(area?.top ?? 0, 0);
    const visibleBottom = Math.min(area?.bottom ?? window.innerHeight, window.innerHeight);
    if (cursorLine.bottom < visibleTop || cursorLine.top > visibleBottom) return toBottom();

    const centered = cursorLine.top + cursorLine.height / 2 - dockHeight / 2;
    const top = Math.min(Math.max(centered, visibleTop + 4), visibleBottom - dockHeight - 4);
    // Right after the line's text; on a long line it stops at the editor's
    // right edge (covering the line's end).
    const maxLeft = rootRect.right - EDGE_GAP - dockWidth;
    const left = Math.max(Math.min(cursorLine.right + TEXT_GAP, maxLeft), rootRect.left);
    setPosition(prev =>
      prev.kind === "anchored" && Math.abs(prev.top - top) < 1 && Math.abs(prev.left - left) < 1 ? prev : { kind: "anchored", top, left },
    );
  }, [dockRef]);

  const schedule = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(measure);
  }, [measure]);

  useEffect(() => {
    const onSelection = () => {
      if (frozenRef.current) return;
      const block = topLevelBlock(window.getSelection()?.anchorNode);
      // Selection outside the editor (e.g. clicking the dock): keep the last paragraph.
      if (!block) return;
      if (block !== blockRef.current) {
        blockRef.current = block;
        lineOffsetRef.current = null;
        caretXRef.current = null;
        // Observed here: the editor may mount after this dock does.
        if (block.parentElement) observer?.observe(block.parentElement);
      }
      // Follows the cursor's line (typing moves it along the line's end).
      schedule();
    };
    // Text added/removed above the paragraph moves it without a selection
    // change (editor resizes); the dock resizes with the mode buttons.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    if (dockRef.current) observer?.observe(dockRef.current);
    document.addEventListener("selectionchange", onSelection);
    // Capture: the editor scrolls inside its own container, not the window.
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      document.removeEventListener("selectionchange", onSelection);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
      cancelAnimationFrame(frameRef.current);
    };
  }, [schedule, dockRef]);

  // After recording, catch up with wherever the cursor went meanwhile.
  useEffect(() => {
    if (!frozen) schedule();
  }, [frozen, schedule]);

  return position;
}

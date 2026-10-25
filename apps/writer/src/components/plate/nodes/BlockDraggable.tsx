"use client";

import * as React from "react";
import { useDraggable, useDropLine } from "@platejs/dnd";
import type { PlateElementProps, RenderNodeWrapper } from "platejs/react";
import { Tooltip } from "@mantine/core";
import { IconGripVertical, IconMessage } from "@tabler/icons-react";
import { elementCommentIds, useCommentUI } from "../comments";

/**
 * Wraps every top-level block with:
 * - a "Seret untuk memindahkan" drag handle in the left gutter (shown on
 *   hover), backed by @platejs/dnd — the move is an ordinary Slate
 *   move_node op, so it syncs to every collaborator through Yjs;
 * - a comment-count badge in the right margin when the block has open
 *   comment threads (click -> opens them in the comments panel).
 *
 * Nested blocks (table cells' paragraphs, code lines) aren't individually
 * draggable — the whole table / code block moves as one.
 */
export const BlockDraggable: RenderNodeWrapper = ({ path, element }) => {
  if (path.length !== 1 || !(element as any).id) return;
  return (props) => <Draggable {...props} />;
};

function Draggable(props: PlateElementProps) {
  const { children, element } = props;
  const [hovered, setHovered] = React.useState(false);
  const { isDragging, nodeRef, previewRef, handleRef } = useDraggable({ element });
  const contentRef = React.useRef<HTMLDivElement>(null);
  const firstLineTop = useFirstLineTop(nodeRef, contentRef);

  return (
    // The WHOLE wrapper (gutter + block + margins) is the drop target —
    // `flow-root` keeps the block's own top/bottom margins inside it instead
    // of collapsing out, so the gaps between blocks are droppable too.
    // Otherwise the cursor shows "not allowed" everywhere except directly
    // over a block's text.
    <div
      ref={nodeRef}
      style={{ position: "relative", display: "flow-root", opacity: isDragging ? 0.45 : 1 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        contentEditable={false}
        style={{
          position: "absolute",
          left: -30,
          top: firstLineTop,
          height: GUTTER_HEIGHT,
          display: "flex",
          alignItems: "center",
          opacity: hovered && !isDragging ? 1 : 0,
          transition: "opacity 0.12s ease",
          userSelect: "none",
          zIndex: 1,
        }}
      >
        <Tooltip label="Seret untuk memindahkan" position="top" withArrow openDelay={300}>
          <div>
            <div
              ref={handleRef}
              data-plate-prevent-deselect
              style={{
                cursor: "grab",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 20,
                height: 24,
                borderRadius: 4,
                color: "var(--mantine-color-gray-6)",
              }}
            >
              <IconGripVertical size={16} />
            </div>
          </div>
        </Tooltip>
      </div>

      <div ref={previewRef} style={{ display: "none" }} />

      <div ref={contentRef} style={{ position: "relative" }}>
        {children}
        <DropLine id={(element as any).id} />
      </div>

      <BlockCommentBadge element={element} top={firstLineTop} />
    </div>
  );
}

const GUTTER_HEIGHT = 24;

/**
 * Offset (within the wrapper) that vertically centers a GUTTER_HEIGHT-tall
 * gutter item on the block's FIRST line of text — so the drag handle and
 * comment badge sit level with the text, whatever the block's margins
 * (paragraph vs heading) or font size. Re-measured after every render; the
 * state update bails out when nothing moved.
 */
function useFirstLineTop(
  wrapperRef: React.RefObject<HTMLDivElement | null>,
  contentRef: React.RefObject<HTMLDivElement | null>
) {
  const [top, setTop] = React.useState(0);
  React.useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const block = contentRef.current?.firstElementChild as HTMLElement | null;
    if (!wrapper || !block) return;
    const style = getComputedStyle(block);
    const fontSize = parseFloat(style.fontSize) || 16;
    const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.5;
    const blockTop = block.getBoundingClientRect().top - wrapper.getBoundingClientRect().top;
    const next = Math.round(blockTop + (parseFloat(style.paddingTop) || 0) + (lineHeight - GUTTER_HEIGHT) / 2);
    setTop((prev) => (prev === next ? prev : next));
  });
  return top;
}

function DropLine({ id }: { id: string }) {
  const { dropLine } = useDropLine({ id });
  if (!dropLine) return null;
  return (
    <div
      contentEditable={false}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        height: 3,
        borderRadius: 2,
        background: "var(--mantine-color-blue-5)",
        pointerEvents: "none",
        ...(dropLine === "top" ? { top: -2 } : { bottom: -2 }),
      }}
    />
  );
}

function BlockCommentBadge({ element, top }: { element: any; top: number }) {
  const ui = useCommentUI();
  if (!ui) return null;
  const ids = elementCommentIds(element, ui.threads);
  if (ids.length === 0) return null;
  const replyCount = ids.reduce((sum, id) => sum + (ui.threads[id]?.replies.length || 0), 0);

  return (
    <div
      contentEditable={false}
      style={{ position: "absolute", right: -34, top, height: GUTTER_HEIGHT, display: "flex", alignItems: "center", userSelect: "none" }}
    >
      <Tooltip label={`${ids.length} diskusi · ${replyCount} komentar`} position="left" withArrow>
        <button
          type="button"
          onClick={() => ui.openThread(ids[0])}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "var(--mantine-color-gray-6)",
            fontSize: 12,
            padding: "2px 4px",
            borderRadius: 4,
          }}
        >
          <IconMessage size={15} />
          {replyCount}
        </button>
      </Tooltip>
    </div>
  );
}

"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { RangeApi } from "platejs";
import { useEditorRef, useEditorSelection } from "platejs/react";
import { Button } from "@mantine/core";
import { IconMessagePlus } from "@tabler/icons-react";

/**
 * A small "Komentar" button floating just above the current text selection
 * (like Google Docs / Plate's own demo), instead of a fixed toolbar button.
 * Must be rendered inside <Plate>.
 */
export function FloatingCommentButton({ hidden, onComment }: { hidden?: boolean; onComment: () => void }) {
  const editor = useEditorRef();
  const selection = useEditorSelection();
  const [rect, setRect] = React.useState<{ top: number; left: number } | null>(null);

  React.useEffect(() => {
    if (hidden || !selection || RangeApi.isCollapsed(selection)) {
      setRect(null);
      return;
    }

    const measure = () => {
      const domSelection = window.getSelection();
      if (!domSelection || domSelection.rangeCount === 0 || domSelection.isCollapsed) {
        setRect(null);
        return;
      }
      // Only for selections inside THIS editor, not e.g. the comment panel.
      const editable = editor.api.toDOMNode(editor);
      if (!editable || !editable.contains(domSelection.anchorNode)) {
        setRect(null);
        return;
      }
      const r = domSelection.getRangeAt(0).getBoundingClientRect();
      if (!r.width && !r.height) {
        setRect(null);
        return;
      }
      setRect({ top: r.top, left: r.left + r.width / 2 });
    };

    const frame = requestAnimationFrame(measure);
    // Keep it glued to the text while the editor (or page) scrolls.
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [selection, hidden, editor]);

  if (!rect) return null;

  return createPortal(
    <Button
      size="xs"
      radius="xl"
      variant="filled"
      color="yellow"
      leftSection={<IconMessagePlus size={14} />}
      // Keep the editor's text selection when the button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onComment}
      style={{
        position: "fixed",
        top: Math.max(8, rect.top - 38),
        left: rect.left,
        transform: "translateX(-50%)",
        zIndex: 300,
        boxShadow: "0 4px 14px rgba(0, 0, 0, 0.15)",
      }}
    >
      Komentar
    </Button>,
    document.body
  );
}

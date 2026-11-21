"use client";

import * as React from "react";
import { ActionIcon, Divider, Group, Tooltip } from "@mantine/core";
import {
  IconBold,
  IconCode,
  IconH1,
  IconH2,
  IconH3,
  IconItalic,
  IconList,
  IconListNumbers,
  IconPhoto,
  IconPilcrow,
  IconStrikethrough,
  IconUnderline,
} from "@tabler/icons-react";
import type { BlockNoteCompatEditor } from "@/lib/plateCompat/editor";
import { pickAndInsertImage } from "./kit";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl";

type MarkKey = "bold" | "italic" | "underline" | "strike" | "code";
const MARKS: { key: MarkKey; plateKey: string; label: string; hotkey?: string; icon: React.ReactNode }[] = [
  { key: "bold", plateKey: "bold", label: "Tebal", hotkey: `${MOD}+B`, icon: <IconBold size={17} /> },
  { key: "italic", plateKey: "italic", label: "Miring", hotkey: `${MOD}+I`, icon: <IconItalic size={17} /> },
  { key: "underline", plateKey: "underline", label: "Garis bawah", hotkey: `${MOD}+U`, icon: <IconUnderline size={17} /> },
  { key: "strike", plateKey: "strikethrough", label: "Coret", icon: <IconStrikethrough size={17} /> },
  { key: "code", plateKey: "code", label: "Kode", icon: <IconCode size={17} /> },
];

type BlockKind = "paragraph" | "h1" | "h2" | "h3" | "bullet" | "numbered";
const BLOCKS: { kind: BlockKind; label: string; icon: React.ReactNode }[] = [
  { kind: "paragraph", label: "Teks biasa", icon: <IconPilcrow size={17} /> },
  { kind: "h1", label: "Judul 1", icon: <IconH1 size={17} /> },
  { kind: "h2", label: "Judul 2", icon: <IconH2 size={17} /> },
  { kind: "h3", label: "Judul 3", icon: <IconH3 size={17} /> },
  { kind: "bullet", label: "List butir", icon: <IconList size={17} /> },
  { kind: "numbered", label: "List angka", icon: <IconListNumbers size={17} /> },
];

function currentBlockKind(editor: BlockNoteCompatEditor): BlockKind | null {
  try {
    const block = editor.getTextCursorPosition()?.block as any;
    if (!block) return null;
    if (block.type === "heading") {
      const level = Number(block.props?.level ?? 1);
      return level === 1 ? "h1" : level === 2 ? "h2" : "h3";
    }
    if (block.type === "bulletListItem") return "bullet";
    if (block.type === "numberedListItem") return "numbered";
    if (block.type === "paragraph") return "paragraph";
    return null;
  } catch {
    return null;
  }
}

/**
 * Compact formatting bar for the draft editor: marks (with active state),
 * block type and image upload. Every button keeps the editor focus and
 * selection (mousedown is prevented), so you can keep typing right after.
 */
export function FormatToolbar({ editor }: { editor: BlockNoteCompatEditor }) {
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => editor.onChange(force), [editor]);

  let activeMarks: Record<string, unknown> = {};
  try {
    activeMarks = ((editor.raw.api as any).marks?.() ?? {}) as Record<string, unknown>;
  } catch {
    activeMarks = {};
  }
  const blockKind = currentBlockKind(editor);

  const keepFocus = (event: React.MouseEvent) => event.preventDefault();

  const setBlock = (kind: BlockKind) => {
    const pos = editor.getTextCursorPosition();
    if (!pos?.block) return;
    const update =
      kind === "paragraph"
        ? { type: "paragraph" }
        : kind === "bullet"
          ? { type: kind === blockKind ? "paragraph" : "bulletListItem" }
          : kind === "numbered"
            ? { type: kind === blockKind ? "paragraph" : "numberedListItem" }
            : kind === blockKind
              ? { type: "paragraph" }
              : { type: "heading", props: { level: Number(kind.slice(1)) } };
    editor.updateBlock(pos.block, update as any);
    // updateBlock re-creates the node, so put the caret back at its end.
    editor.setTextCursorPosition(pos.block, "end");
  };

  const button = (key: string, label: string, icon: React.ReactNode, active: boolean, onClick: () => void) => (
    <Tooltip key={key} label={label} position="bottom" withArrow openDelay={250}>
      <ActionIcon
        variant={active ? "light" : "subtle"}
        color={active ? "blue" : "gray"}
        size="md"
        radius="md"
        aria-label={label}
        aria-pressed={active}
        onMouseDown={keepFocus}
        onClick={onClick}
        className="writer-tool"
      >
        {icon}
      </ActionIcon>
    </Tooltip>
  );

  return (
    <Group gap={2} wrap="nowrap" className="writer-format-toolbar">
      {MARKS.map((mark) =>
        button(
          mark.key,
          mark.hotkey ? `${mark.label} (${mark.hotkey})` : mark.label,
          mark.icon,
          Boolean(activeMarks[mark.plateKey]),
          () => {
            editor.toggleStyles({ [mark.key]: true });
            editor.focus();
          }
        )
      )}
      <Divider orientation="vertical" mx={4} />
      {BLOCKS.map((block) => button(block.kind, block.label, block.icon, blockKind === block.kind, () => setBlock(block.kind)))}
      <Divider orientation="vertical" mx={4} />
      {button("image", "Sisipkan gambar (juga bisa paste / drag & drop)", <IconPhoto size={17} />, false, () =>
        pickAndInsertImage(editor.raw as any)
      )}
    </Group>
  );
}

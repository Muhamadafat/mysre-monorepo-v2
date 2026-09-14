/**
 * A BlockNote-Editor-shaped facade over a Plate editor instance.
 *
 * Why this exists: PlateEditor.tsx's own AI/citation/search/undo-redo logic,
 * and draft/page.tsx's toolbar handlers, were both written against
 * BlockNote's editor API (`.document`, `.insertBlocks()`, `.replaceBlocks()`,
 * `.updateBlock()`, `.removeBlocks()`, `.getTextCursorPosition()`,
 * `.setTextCursorPosition()`, `.insertInlineContent()`, `.toggleStyles()`,
 * `.createLink()`, `.focus()`, `.onChange()`). None of that ~150-call-site
 * business logic needs to change when the underlying engine becomes Plate —
 * it only needs the same methods to keep existing, backed by Plate's
 * `editor.tf`/`editor.api` underneath. That's all this class does.
 *
 * The document itself is always flat in this app (no block ever nests
 * children — verified against both this app's code and the drafts already
 * in Postgres), so every "find block by id" below is a plain top-level
 * index lookup, not a tree search.
 */
import type { PlateEditor } from "platejs/react";
import type { TElement } from "platejs";
import {
  blockNoteBlockToPlateElement,
  plateValueToBlockNoteBlocks,
} from "./convert";
import type { Block, BlockIdentifier, InlineContent, PartialBlock } from "./types";
import { resolveBlockId } from "./types";

type Listener = () => void;

/**
 * BlockNote's own types declare every "reference block" parameter as
 * non-nullable, but plenty of call sites across this app pass through a
 * `.find(...)` result or a `getTextCursorPosition().block` without a null
 * check first (matching how BlockNote behaved in practice). Accepting
 * `null | undefined` here — and simply no-op'ing — keeps every one of those
 * call sites compiling and behaving the same, without editing ~40 spots.
 */
type BlockRef = Block | BlockIdentifier | null | undefined;

export class BlockNoteCompatEditor {
  constructor(private plate: PlateEditor) {}

  /** Escape hatch for anything not covered below. */
  get raw(): PlateEditor {
    return this.plate;
  }

  private listeners = new Set<Listener>();

  /** Called from the <Plate onChange> prop — see PlateEditor.tsx. */
  notifyChange(): void {
    this.listeners.forEach((l) => l());
  }

  onChange(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  get document(): Block[] {
    return plateValueToBlockNoteBlocks(this.plate.children as TElement[]);
  }

  private indexOf(id: BlockRef): number {
    if (id === null || id === undefined) return -1;
    const targetId = resolveBlockId(id as BlockIdentifier);
    return (this.plate.children as TElement[]).findIndex((n) => (n as any).id === targetId);
  }

  private elementAt(index: number): TElement | undefined {
    return (this.plate.children as TElement[])[index];
  }

  /** Always resolves to a real block, like BlockNote's own (non-nullable) type promises. */
  getTextCursorPosition(): { block: Block } {
    const entry = this.plate.api.block<TElement>({ highest: true });
    const node = entry?.[0] ?? (this.plate.children as TElement[])[0];
    // Between mounts (e.g. the Yjs doc hasn't finished syncing yet) the
    // editor can momentarily have zero children — fall back to an empty
    // paragraph rather than crashing on a selection-change fired mid-init.
    const safeNode: TElement = node ?? { id: "empty", type: "p", children: [{ text: "" }] };
    return { block: plateValueToBlockNoteBlocks([safeNode])[0] };
  }

  setTextCursorPosition(block: BlockRef, placement: "start" | "end" = "start"): void {
    const index = this.indexOf(block);
    if (index === -1) return;
    this.plate.tf.select([index], { edge: placement });
    this.plate.tf.focus();
  }

  focus(): void {
    this.plate.tf.focus();
  }

  insertBlocks(
    blocksToInsert: PartialBlock[],
    referenceBlock: BlockRef,
    placement: "before" | "after" = "after"
  ): void {
    const refIndex = this.indexOf(referenceBlock);
    const at = refIndex === -1 ? this.plate.children.length : refIndex + (placement === "after" ? 1 : 0);
    const nodes = blocksToInsert.map((b) => blockNoteBlockToPlateElement(b));
    this.plate.tf.insertNodes(nodes, { at: [at] });
  }

  removeBlocks(blocksToRemove: BlockRef[]): void {
    const indices = blocksToRemove
      .map((b) => this.indexOf(b))
      .filter((i) => i !== -1)
      .sort((a, b) => b - a); // descending, so earlier removals don't shift later indices
    for (const i of indices) {
      this.plate.tf.removeNodes({ at: [i] });
    }
  }

  updateBlock(blockToUpdate: BlockRef, update: PartialBlock): void {
    const index = this.indexOf(blockToUpdate);
    if (index === -1) return;
    const current = plateValueToBlockNoteBlocks([this.elementAt(index)!])[0];
    const merged: PartialBlock = {
      id: current.id,
      type: update.type ?? current.type,
      props: { ...current.props, ...(update.props || {}) },
      content: update.content ?? current.content,
      children: [],
    };
    const newNode = blockNoteBlockToPlateElement(merged);
    (newNode as any).id = current.id;
    this.plate.tf.removeNodes({ at: [index] });
    this.plate.tf.insertNodes(newNode, { at: [index] });
  }

  replaceBlocks(blocksToRemove: BlockRef[], blocksToInsert: PartialBlock[]): void {
    if (blocksToRemove.length === 0) {
      this.plate.tf.insertNodes(blocksToInsert.map((b) => blockNoteBlockToPlateElement(b)), {
        at: [this.plate.children.length],
      });
      return;
    }
    const indices = blocksToRemove
      .map((b) => this.indexOf(b))
      .filter((i) => i !== -1)
      .sort((a, b) => a - b);
    if (indices.length === 0) return;
    const insertAt = indices[0];
    // Remove in descending order so earlier indices stay valid.
    for (let i = indices.length - 1; i >= 0; i--) {
      this.plate.tf.removeNodes({ at: [indices[i]] });
    }
    const nodes = blocksToInsert.map((b) => blockNoteBlockToPlateElement(b));
    if (nodes.length > 0) {
      this.plate.tf.insertNodes(nodes, { at: [insertAt] });
    }
  }

  /** Inserts inline content at the current selection (BlockNote's insertInlineContent). */
  insertInlineContent(content: InlineContent[] | string): void {
    if (typeof content === "string") {
      this.plate.tf.insertText(content);
      return;
    }
    for (const item of content) {
      if (item.type === "text") {
        const marks: Record<string, unknown> = {};
        if (item.styles?.bold) marks.bold = true;
        if (item.styles?.italic) marks.italic = true;
        if (item.styles?.underline) marks.underline = true;
        if (item.styles?.strike) marks.strikethrough = true;
        if (item.styles?.code) marks.code = true;
        if (item.styles?.textColor && item.styles.textColor !== "default") marks.color = item.styles.textColor;
        if (item.styles?.backgroundColor && item.styles.backgroundColor !== "default") {
          marks.backgroundColor = item.styles.backgroundColor;
        }
        this.plate.tf.insertNodes(
          { text: item.text, ...marks } as any,
          { at: this.plate.selection ?? undefined, select: true }
        );
      }
    }
  }

  toggleStyles(styles: Record<string, boolean>): void {
    const keyMap: Record<string, string> = {
      bold: "bold",
      italic: "italic",
      underline: "underline",
      strike: "strikethrough",
      code: "code",
    };
    for (const [key, value] of Object.entries(styles)) {
      if (!value) continue;
      this.plate.tf.toggleMark(keyMap[key] || key);
    }
  }

  /**
   * Character offset of the selection focus within its containing block's
   * text (assumes a flat block -> text-leaves structure, true for every
   * paragraph/list-item this app inserts). Used by the AI "continue exactly
   * where I clicked" insertion mode — replaces the old raw
   * `_tiptapEditor.state.selection.from` ProseMirror-absolute-position hack,
   * which has no equivalent under Plate/Slate.
   */
  getCursorOffsetInBlock(): number {
    const sel = this.plate.selection;
    if (!sel) return 0;
    const entry = this.plate.api.block<TElement>({ highest: true });
    if (!entry) return 0;
    const [blockNode] = entry;
    const leafIndex = sel.focus.path[sel.focus.path.length - 1] ?? 0;
    const children = ((blockNode as any).children || []) as any[];
    let total = 0;
    for (let i = 0; i < leafIndex && i < children.length; i++) {
      total += String(children[i]?.text ?? "").length;
    }
    return total + sel.focus.offset;
  }

  /** Inverse of getCursorOffsetInBlock: place the selection at a character offset within a block's text. */
  selectInBlock(block: BlockRef, charOffset: number): void {
    const index = this.indexOf(block);
    if (index === -1) return;
    const node = this.elementAt(index) as any;
    const children = (node?.children || []) as any[];
    let remaining = charOffset;
    let leafIndex = 0;
    for (; leafIndex < children.length; leafIndex++) {
      const len = String(children[leafIndex]?.text ?? "").length;
      if (remaining <= len) break;
      remaining -= len;
    }
    if (leafIndex >= children.length) {
      leafIndex = Math.max(0, children.length - 1);
      remaining = String(children[leafIndex]?.text ?? "").length;
    }
    const point = { path: [index, leafIndex], offset: Math.max(0, remaining) };
    this.plate.tf.select({ anchor: point, focus: point });
    this.plate.tf.focus();
  }

  createLink(href: string, text: string): void {
    this.plate.tf.insertNodes(
      { type: "a", url: href, children: [{ text }] } as any,
      { at: this.plate.selection ?? undefined, select: true }
    );
  }
}

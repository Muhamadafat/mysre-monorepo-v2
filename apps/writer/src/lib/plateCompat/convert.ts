/**
 * Conversion between BlockNote-shaped `Block[]` (the format every other part
 * of the app — draft/page.tsx, /api/draft/*, and every row already sitting
 * in the DraftSection table — persists and manipulates) and Plate's native
 * Slate `Value` (an array of elements with `children`, the shape the live
 * editor and the Yjs sync actually operate on).
 *
 * Nothing outside PlateEditor.tsx needs to know this conversion exists —
 * it's an internal detail of swapping the rendering/editing engine while
 * keeping the document format the rest of the app already depends on.
 */
import { nanoid } from "platejs";
import type { Descendant, TElement, TText } from "platejs";
type PlateValue = TElement[];
import type {
  Block,
  InlineContent,
  InlineStyles,
  PartialBlock,
  TableContent,
} from "./types";

// ---- BlockNote type <-> Plate element type -------------------------------

const HEADING_TYPES = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

function headingLevelToPlateType(level: number): string {
  const idx = Math.min(Math.max(Math.round(level) - 1, 0), 5);
  return HEADING_TYPES[idx];
}

function plateHeadingTypeToLevel(type: string): number {
  const idx = HEADING_TYPES.indexOf(type as (typeof HEADING_TYPES)[number]);
  return idx === -1 ? 1 : idx + 1;
}

// ---- inline content (text runs) ------------------------------------------

function styleToLeafProps(styles?: InlineStyles): Record<string, unknown> {
  if (!styles) return {};
  const leaf: Record<string, unknown> = {};
  if (styles.bold) leaf.bold = true;
  if (styles.italic) leaf.italic = true;
  if (styles.underline) leaf.underline = true;
  if (styles.strike) leaf.strikethrough = true;
  if (styles.code) leaf.code = true;
  if (styles.textColor && styles.textColor !== "default") leaf.color = styles.textColor;
  if (styles.backgroundColor && styles.backgroundColor !== "default") {
    leaf.backgroundColor = styles.backgroundColor;
  }
  return leaf;
}

function leafPropsToStyle(leaf: Record<string, unknown>): InlineStyles {
  const styles: InlineStyles = {};
  if (leaf.bold) styles.bold = true;
  if (leaf.italic) styles.italic = true;
  if (leaf.underline) styles.underline = true;
  if (leaf.strikethrough) styles.strike = true;
  if (leaf.code) styles.code = true;
  if (typeof leaf.color === "string") styles.textColor = leaf.color;
  if (typeof leaf.backgroundColor === "string") styles.backgroundColor = leaf.backgroundColor;
  return styles;
}

function inlineContentToPlate(content: InlineContent[] | undefined): Descendant[] {
  if (!content || content.length === 0) return [{ text: "" }];
  const out: Descendant[] = [];
  for (const item of content) {
    if (item.type === "link") {
      out.push({
        type: "a",
        url: item.href,
        children: item.content.map((t) => ({ text: t.text, ...styleToLeafProps(t.styles) })),
      } as TElement);
    } else {
      out.push({ text: item.text, ...styleToLeafProps(item.styles) });
    }
  }
  return out.length > 0 ? out : [{ text: "" }];
}

function plateInlineToBlockNote(children: Descendant[]): InlineContent[] {
  const out: InlineContent[] = [];
  for (const node of children) {
    if (node && typeof node === "object" && "type" in node && (node as TElement).type === "a") {
      const el = node as TElement;
      out.push({
        type: "link",
        href: (el as any).url || "",
        content: (el.children as TText[]).map((t) => ({
          type: "text",
          text: String((t as any).text ?? ""),
          styles: leafPropsToStyle(t as any),
        })),
      });
    } else {
      const t = node as any;
      out.push({ type: "text", text: String(t.text ?? ""), styles: leafPropsToStyle(t) });
    }
  }
  return out;
}

// ---- one block <-> one (or more) Plate top-level nodes --------------------

function isTableContent(content: unknown): content is TableContent {
  return !!content && typeof content === "object" && (content as TableContent).type === "tableContent";
}

function tableCellToPlateInline(cell: InlineContent[] | { content: InlineContent[] }): InlineContent[] {
  return Array.isArray(cell) ? cell : cell.content;
}

/** Convert one BlockNote block (ignoring nested `children`, handled by the caller) into a Plate element. */
function blockToPlateElement(block: Block | PartialBlock): TElement {
  const id = (block as Block).id || nanoid();
  const props = block.props || {};
  const bn = { bnType: block.type, bnProps: props };

  switch (block.type) {
    case "heading": {
      const level = Number((props as any).level) || 1;
      return {
        id,
        type: headingLevelToPlateType(level),
        ...bn,
        children: inlineContentToPlate(block.content as InlineContent[]),
      } as TElement;
    }
    case "bulletListItem":
    case "numberedListItem": {
      return {
        id,
        type: "p",
        listStyleType: block.type === "bulletListItem" ? "disc" : "decimal",
        indent: Number((props as any).level) || 1,
        ...bn,
        children: inlineContentToPlate(block.content as InlineContent[]),
      } as TElement;
    }
    case "codeBlock": {
      const text = typeof block.content === "string" ? block.content : "";
      const lines = text.length > 0 ? text.split("\n") : [""];
      return {
        id,
        type: "code_block",
        lang: (props as any).language,
        ...bn,
        children: lines.map((line) => ({
          type: "code_line",
          children: [{ text: line }],
        })),
      } as TElement;
    }
    case "table": {
      const content = block.content;
      if (isTableContent(content)) {
        return {
          id,
          type: "table",
          colSizes: content.columnWidths,
          ...bn,
          children: content.rows.map((row) => ({
            type: "tr",
            children: row.cells.map((cell) => ({
              type: "td",
              children: [{ type: "p", children: inlineContentToPlate(tableCellToPlateInline(cell)) }],
            })),
          })),
        } as TElement;
      }
      // Malformed/legacy table content — fall back to an empty paragraph
      // rather than throwing, so one bad row never blocks loading a draft.
      return { id, type: "p", ...bn, children: [{ text: "" }] } as TElement;
    }
    case "divider":
    case "horizontalRule": {
      return { id, type: "hr", ...bn, children: [{ text: "" }] } as TElement;
    }
    case "image": {
      return {
        id,
        type: "img",
        url: (props as any).url,
        caption: (props as any).caption,
        width: (props as any).width,
        ...bn,
        children: [{ text: "" }],
      } as TElement;
    }
    default: {
      // paragraph, and anything unrecognized (legacy/future block types) —
      // render as a plain paragraph rather than dropping content.
      return {
        id,
        type: "p",
        ...bn,
        children: inlineContentToPlate(
          Array.isArray(block.content) ? (block.content as InlineContent[]) : undefined
        ),
      } as TElement;
    }
  }
}

export function blockNoteBlocksToPlateValue(blocks: (Block | PartialBlock)[]): PlateValue {
  if (!blocks || blocks.length === 0) {
    return [{ id: nanoid(), type: "p", children: [{ text: "" }] } as TElement];
  }
  return blocks.map(blockToPlateElement);
}

// ---- Plate element -> BlockNote block (reverse direction) -----------------

function plateElementToBlock(node: TElement): Block {
  const bnType = (node as any).bnType as string | undefined;
  const bnProps = ((node as any).bnProps as Record<string, unknown>) || {};
  const id = (node as any).id || nanoid();

  if (HEADING_TYPES.includes(node.type as any)) {
    return {
      id,
      type: "heading",
      props: { ...bnProps, level: plateHeadingTypeToLevel(node.type) },
      content: plateInlineToBlockNote(node.children as Descendant[]),
      children: [],
    };
  }

  if (node.type === "code_block") {
    const text = (node.children as TElement[])
      .map((line) => (line.children as TText[]).map((t) => String((t as any).text ?? "")).join(""))
      .join("\n");
    return {
      id,
      type: "codeBlock",
      props: { ...bnProps, language: (node as any).lang },
      content: text,
      children: [],
    };
  }

  if (node.type === "table") {
    const rows = (node.children as TElement[]).map((tr) => ({
      cells: (tr.children as TElement[]).map((td) => {
        const cellParagraph = (td.children as TElement[])[0];
        return plateInlineToBlockNote((cellParagraph?.children as Descendant[]) || [{ text: "" }]);
      }),
    }));
    return {
      id,
      type: "table",
      props: bnProps,
      content: { type: "tableContent", columnWidths: (node as any).colSizes, rows },
      children: [],
    };
  }

  if (node.type === "img") {
    return {
      id,
      type: "image",
      props: {
        ...bnProps,
        url: (node as any).url,
        caption: (node as any).caption,
        width: (node as any).width,
      },
      content: undefined,
      children: [],
    };
  }

  if (node.type === "hr") {
    return { id, type: bnType || "divider", props: bnProps, content: [], children: [] };
  }

  // 'p' — either a plain paragraph or a list item (listStyleType set by ListKit).
  const listStyleType = (node as any).listStyleType as string | undefined;
  if (listStyleType) {
    return {
      id,
      type: listStyleType === "decimal" ? "numberedListItem" : "bulletListItem",
      props: { ...bnProps, level: (node as any).indent || 1 },
      content: plateInlineToBlockNote(node.children as Descendant[]),
      children: [],
    };
  }

  return {
    id,
    type: bnType || "paragraph",
    props: bnProps,
    content: plateInlineToBlockNote(node.children as Descendant[]),
    children: [],
  };
}

export function plateValueToBlockNoteBlocks(value: TElement[]): Block[] {
  return value.filter(Boolean).map(plateElementToBlock);
}

/** Convert a single BlockNote block (used by insertBlocks/updateBlock) to a Plate element. */
export function blockNoteBlockToPlateElement(block: PartialBlock): TElement {
  return blockToPlateElement(block);
}

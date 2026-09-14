/**
 * BlockNote-shaped document types, kept independent of `@blocknote/core`.
 *
 * The rest of the app (draft/page.tsx, the AI generation logic inside
 * PlateEditor itself, the /api/draft/* routes, and the DraftSection rows
 * already sitting in Postgres) all speak this exact JSON shape. Switching
 * the underlying rich-text engine to Plate does NOT change this contract —
 * `BlockNoteCompatEditor` (see editor.ts) converts to/from Plate's Slate
 * tree at the boundary, so every existing call site, and every already
 * saved draft, keeps working unmodified.
 */

export interface InlineStyles {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  textColor?: string;
  backgroundColor?: string;
  [key: string]: unknown;
}

export interface TextInlineContent {
  type: "text";
  text: string;
  styles?: InlineStyles;
}

export interface LinkInlineContent {
  type: "link";
  href: string;
  content: TextInlineContent[];
}

export type InlineContent = TextInlineContent | LinkInlineContent;

export interface TableCell {
  type: "tableCell";
  content: InlineContent[];
  props?: Record<string, unknown>;
}

export interface TableContent {
  type: "tableContent";
  columnWidths?: (number | undefined)[];
  headerRows?: number;
  headerCols?: number;
  rows: { cells: (InlineContent[] | TableCell)[] }[];
}

export interface Block<T extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  type: string;
  props: T;
  content?: InlineContent[] | TableContent | string;
  children: Block[];
}

/** What callers pass in when they don't need every field populated. `type` defaults to "paragraph" if omitted. */
export type PartialBlock = Partial<Omit<Block, "props" | "content" | "children">> & {
  type?: string;
  props?: Record<string, unknown>;
  content?: InlineContent[] | TableContent | string;
  children?: PartialBlock[];
};

export type BlockIdentifier = string | { id: string };

export function resolveBlockId(id: BlockIdentifier): string {
  return typeof id === "string" ? id : id.id;
}

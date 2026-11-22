/**
 * Peta konsep = the writing's outline as a graph. It is never stored: the
 * editor rebuilds it from the text on every change, and the penelitian page
 * rebuilds it the same way from the live document or a saved version.
 *
 * Headings H1–H4 become nodes (H1 green, H2–H4 yellow) linked to the nearest
 * heading above them; every other non-empty text block becomes a grey node
 * under the latest heading.
 */

export interface ConceptMapNode {
  id: string;
  label: string;
  title: string;
  type: string;
  shape: string;
  margin: { top: number; right: number; bottom: number; left: number };
  font: { size: number; bold?: boolean };
  color: { background: string; border: string };
}

export interface ConceptMapEdge {
  id: string;
  from: string;
  to: string;
  arrows: "to";
}

export interface ConceptMapData {
  nodes: ConceptMapNode[];
  edges: ConceptMapEdge[];
}

type AnyBlock = {
  id?: string;
  type?: string;
  props?: { level?: number };
  content?: unknown;
  children?: AnyBlock[];
  text?: string;
};

const MARGIN = { top: 10, right: 15, bottom: 10, left: 15 };
/** Live (Plate/Slate) block types that carry no outline text. */
const SLATE_SKIP = new Set(["img", "image", "table", "hr", "media_embed", "toc", "code_block", "equation"]);

export function truncateByWords(text: string, limit: number) {
  const words = text.split(" ");
  return words.length > limit ? `${words.slice(0, limit).join(" ")}...` : text;
}

function slateText(node: AnyBlock): string {
  if (typeof node.text === "string") return node.text;
  return (node.children ?? []).map(slateText).join("");
}

/** heading level (1–6) or 0 for a paragraph, plus its plain text; null = skip. */
function readBlock(block: AnyBlock): { level: number; text: string } | null {
  // Saved version / editor state: BlockNote-style { type, props, content }
  // (these may also carry a `children` array, so test for content/props).
  if ("content" in block || "props" in block || !Array.isArray(block.children)) {
    const text = Array.isArray(block.content)
      ? block.content.map((item: { text?: string }) => item?.text || "").join("")
      : typeof block.content === "string" ? block.content : "";
    return { level: block.type === "heading" ? block.props?.level || 1 : 0, text };
  }
  // Live document: Plate/Slate { type: "h1" | "p" | …, children }.
  if (block.type && SLATE_SKIP.has(block.type)) return null;
  const heading = /^h([1-6])$/.exec(block.type ?? "");
  return { level: heading ? Number(heading[1]) : 0, text: slateText(block) };
}

export function buildConceptMap(blocks: AnyBlock[]): ConceptMapData {
  const nodes: ConceptMapNode[] = [];
  const edges: ConceptMapEdge[] = [];
  const lastHeadingIds: Record<number, string | null> = { 1: null, 2: null, 3: null, 4: null };

  blocks.forEach((block, index) => {
    const read = readBlock(block);
    if (!read || read.text.trim() === "") return;
    const nodeId = block.id || `node-${index}`;
    let node: ConceptMapNode | null = null;
    let parentId: string | null = null;

    if (read.level > 0) {
      const level = read.level;
      if (level > 4) return; // the editor's map ignores H5/H6 too
      node = {
        id: nodeId,
        label: truncateByWords(read.text, 5),
        title: read.text,
        type: `H${level}`,
        shape: "box",
        margin: MARGIN,
        font: { size: 18 - level * 2, bold: true },
        color: level === 1
          ? { background: "#40c057", border: "#2f9e44" }
          : { background: "#fcc419", border: "#f59f00" },
      };
      for (let p = level - 1; p >= 1; p--) {
        if (lastHeadingIds[p]) {
          parentId = lastHeadingIds[p];
          break;
        }
      }
      lastHeadingIds[level] = nodeId;
      for (let j = level + 1; j <= 4; j++) lastHeadingIds[j] = null;
    } else {
      node = {
        id: nodeId,
        label: truncateByWords(read.text, 5),
        title: read.text,
        type: "Paragraph",
        shape: "box",
        margin: MARGIN,
        font: { size: 14 },
        color: { background: "#adb5bd", border: "#868e96" },
      };
      for (let p = 4; p >= 1; p--) {
        if (lastHeadingIds[p]) {
          parentId = lastHeadingIds[p];
          break;
        }
      }
    }

    nodes.push(node);
    if (parentId) edges.push({ id: `edge-${parentId}-${nodeId}`, from: parentId, to: nodeId, arrows: "to" });
  });

  return { nodes, edges };
}

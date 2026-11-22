"use client";

import * as React from "react";

/**
 * Read-only renderer for a student's writing, from either source:
 *  - the live Plate/Slate document (PartyKit): { type: "p" | "h1" | "img" | "table" …, children }
 *  - a saved version (BlockNote-style blocks): { type: "paragraph" | "heading" …, props, content }
 * Citation markers like [3] are shown as small chips.
 */

type Leaf = { text?: string; bold?: boolean; italic?: boolean; underline?: boolean; strikethrough?: boolean; code?: boolean };
type SlateNode = { type?: string; children?: SlateNode[]; url?: string; listStyleType?: string; indent?: number; [k: string]: unknown } & Leaf;

function withCitations(text: string, key: string): React.ReactNode {
  if (!/\[\d+\]/.test(text)) return text;
  return text.split(/(\[\d+\])/g).map((part, i) =>
    /^\[\d+\]$/.test(part) ? (
      <span key={`${key}-${i}`} className="adm-cite">
        {part}
      </span>
    ) : (
      part
    )
  );
}

function styled(node: React.ReactNode, leaf: Leaf | Record<string, unknown>, key: string): React.ReactNode {
  let out = node;
  if (leaf.code) out = <code key={`${key}c`}>{out}</code>;
  if (leaf.bold) out = <strong key={`${key}b`}>{out}</strong>;
  if (leaf.italic) out = <em key={`${key}i`}>{out}</em>;
  if (leaf.underline) out = <u key={`${key}u`}>{out}</u>;
  if (leaf.strikethrough || (leaf as Record<string, unknown>).strike) out = <s key={`${key}s`}>{out}</s>;
  return <React.Fragment key={key}>{out}</React.Fragment>;
}

// ── Slate (live) ─────────────────────────────────────────────────────────
function slateInline(nodes: SlateNode[] = [], key: string): React.ReactNode[] {
  return nodes.map((n, i) => {
    const k = `${key}.${i}`;
    if (typeof n.text === "string") return styled(withCitations(n.text, k), n, k);
    if (n.type === "a") {
      return (
        <a key={k} href={String(n.url ?? "#")} target="_blank" rel="noreferrer noopener">
          {slateInline(n.children, k)}
        </a>
      );
    }
    return <React.Fragment key={k}>{slateInline(n.children, k)}</React.Fragment>;
  });
}

function slateText(node: SlateNode): string {
  if (typeof node.text === "string") return node.text;
  return (node.children ?? []).map(slateText).join("");
}

function SlateBlock({ node, k, index, siblings }: { node: SlateNode; k: string; index: number; siblings: SlateNode[] }) {
  const t = node.type ?? "p";
  if (/^h[1-6]$/.test(t)) return React.createElement(t, { className: `adm-${t}` }, slateInline(node.children, k));
  if (t === "img") {
    return (
      <figure className="adm-figure">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={String(node.url ?? "")} alt="" loading="lazy" />
      </figure>
    );
  }
  if (t === "hr") return <hr />;
  if (t === "blockquote") return <blockquote>{slateInline(node.children, k)}</blockquote>;
  if (t === "code_block") return <pre>{(node.children ?? []).map(slateText).join("\n")}</pre>;
  if (t === "table") {
    return (
      <div className="adm-table-wrap">
        <table>
          <tbody>
            {(node.children ?? []).map((row, r) => (
              <tr key={r}>
                {(row.children ?? []).map((cell, c) =>
                  React.createElement(cell.type === "th" ? "th" : "td", { key: c }, slateInline(cell.children, `${k}.${r}.${c}`))
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (node.listStyleType) {
    let n = 1;
    if (node.listStyleType === "decimal") {
      for (let i = index - 1; i >= 0 && siblings[i]?.listStyleType === "decimal"; i--) n++;
    }
    return (
      <div className="adm-li" style={{ marginLeft: (Number(node.indent) || 1) * 22 }}>
        <span className="adm-li-mark">{node.listStyleType === "decimal" ? `${n}.` : "•"}</span>
        <span>{slateInline(node.children, k)}</span>
      </div>
    );
  }
  const text = slateText(node);
  if (!text.trim()) return null;
  return <p>{slateInline(node.children, k)}</p>;
}

// ── BlockNote-style (saved versions) ─────────────────────────────────────
type BnInline = { type?: string; text?: string; styles?: Record<string, unknown>; href?: string; content?: BnInline[] | string };
type BnBlock = { type?: string; props?: Record<string, unknown>; content?: BnInline[] | string | { rows?: { cells: (BnInline[] | string)[] }[] } };

function bnInline(content: BnInline[] | string | undefined, key: string): React.ReactNode {
  if (!content) return null;
  if (typeof content === "string") return withCitations(content, key);
  return content.map((item, i) => {
    const k = `${key}.${i}`;
    if (item.type === "link") {
      return (
        <a key={k} href={item.href} target="_blank" rel="noreferrer noopener">
          {bnInline(item.content, k)}
        </a>
      );
    }
    return styled(withCitations(item.text ?? "", k), item.styles ?? {}, k);
  });
}

function BnBlockView({ block, k, index, blocks }: { block: BnBlock; k: string; index: number; blocks: BnBlock[] }) {
  const props = block.props ?? {};
  const content = block.content as BnInline[] | string | undefined;
  switch (block.type) {
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(props.level ?? 1)));
      return React.createElement(`h${level}`, { className: `adm-h${level}` }, bnInline(content, k));
    }
    case "bulletListItem":
    case "numberedListItem": {
      let n = 1;
      for (let i = index - 1; i >= 0 && blocks[i]?.type === "numberedListItem"; i--) n++;
      return (
        <div className="adm-li">
          <span className="adm-li-mark">{block.type === "numberedListItem" ? `${n}.` : "•"}</span>
          <span>{bnInline(content, k)}</span>
        </div>
      );
    }
    case "image":
      return (
        <figure className="adm-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={String(props.url ?? "")} alt={String(props.caption ?? "")} loading="lazy" />
          {props.caption ? <figcaption>{String(props.caption)}</figcaption> : null}
        </figure>
      );
    case "divider":
    case "horizontalRule":
      return <hr />;
    case "codeBlock":
      return <pre>{typeof content === "string" ? content : (content ?? []).map((c) => c.text ?? "").join("")}</pre>;
    case "table": {
      const rows = (block.content as { rows?: { cells: (BnInline[] | string)[] }[] })?.rows ?? [];
      return (
        <div className="adm-table-wrap">
          <table>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {row.cells.map((cell, c) => (
                    <td key={c}>{bnInline(cell as BnInline[] | string, `${k}.${r}.${c}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    default:
      return content && (typeof content === "string" ? content.trim() : content.length) ? <p>{bnInline(content, k)}</p> : null;
  }
}

export function DocView({ live, blocks }: { live?: SlateNode[] | null; blocks?: BnBlock[] | null }) {
  const empty = live ? !live.some((n) => slateText(n).trim() || n.type === "img" || n.type === "table") : !blocks?.length;
  if (empty) return <p className="adm-doc-empty">Dokumen masih kosong.</p>;
  return (
    <article className="adm-doc">
      {live
        ? live.map((node, i) => <SlateBlock key={i} node={node} k={`n${i}`} index={i} siblings={live} />)
        : blocks!.map((block, i) => <BnBlockView key={i} block={block} k={`b${i}`} index={i} blocks={blocks!} />)}
    </article>
  );
}

/** Plain-text word count of either source. */
export function countWords(live?: SlateNode[] | null, blocks?: BnBlock[] | null): number {
  const text = live
    ? live.map(slateText).join(" ")
    : (blocks ?? [])
        .map((b) => (typeof b.content === "string" ? b.content : Array.isArray(b.content) ? b.content.map((c) => c.text ?? "").join("") : ""))
        .join(" ");
  return text.split(/\s+/).filter(Boolean).length;
}

/** Distinct citation numbers used in the text. */
export function citedNumbers(live?: SlateNode[] | null, blocks?: BnBlock[] | null): number[] {
  const text = live
    ? live.map(slateText).join(" ")
    : (blocks ?? [])
        .map((b) => (typeof b.content === "string" ? b.content : Array.isArray(b.content) ? b.content.map((c) => c.text ?? "").join("") : ""))
        .join(" ");
  return [...new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
}

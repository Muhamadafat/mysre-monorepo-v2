/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * "Kontribusi": who wrote which words of a collaborative document.
 *
 * Every Slate text leaf carries `author` (collaboration user id) and
 * `ai: true` when it came from an AI insertion. Counts are derived from the
 * current document, so they always mean "words in the document right now".
 * Shared by the editor (PlateEditor) and the read-only admin page.
 */

export type Contribution = { typed: number; ai: number };

/**
 * Counts words per author over the whole Slate tree. A word is a maximal
 * run of non-whitespace inside one text block; a word whose characters were
 * written by several people (e.g. someone appended "s" to another person's
 * word) is credited to whoever wrote most of its characters, so every word
 * in the document is counted exactly once. Unattributed text (drafts saved
 * before attribution existed) is counted for nobody.
 */
export function computeContributions(
  nodes: any[],
): Record<string, Contribution> {
  const result: Record<string, Contribution> = {};
  let owners: (string | null)[] = [];
  let chars: string[] = [];

  const creditWord = (start: number, end: number) => {
    const tally = new Map<string, number>();
    let best: string | null = null;
    let bestCount = 0;
    for (let i = start; i < end; i++) {
      const owner = owners[i];
      if (owner === null) continue;
      const count = (tally.get(owner) || 0) + 1;
      tally.set(owner, count);
      if (count > bestCount) {
        best = owner;
        bestCount = count;
      }
    }
    // Majority must also beat the unattributed characters, otherwise a
    // one-letter edit to legacy text would claim the whole word.
    if (best === null || bestCount * 2 < end - start) return;
    const isAI = best.startsWith("ai:");
    const author = best.slice(3);
    const entry = (result[author] ||= { typed: 0, ai: 0 });
    if (isAI) entry.ai += 1;
    else entry.typed += 1;
  };

  const flushBlock = () => {
    let wordStart = -1;
    for (let i = 0; i <= chars.length; i++) {
      const isSpace = i === chars.length || /\s/.test(chars[i]);
      if (isSpace) {
        if (wordStart !== -1) creditWord(wordStart, i);
        wordStart = -1;
      } else if (wordStart === -1) {
        wordStart = i;
      }
    }
    owners = [];
    chars = [];
  };

  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (typeof node.text === "string") {
      const owner =
        typeof node.author === "string"
          ? `${node.ai === true ? "ai" : "me"}:${node.author}`
          : null;
      for (const ch of node.text) {
        chars.push(ch);
        owners.push(owner);
      }
      return;
    }
    if (!Array.isArray(node.children)) return;
    // Links are inline — their text continues the surrounding words.
    // Every other element is a block boundary.
    const isInline = node.type === "a";
    if (!isInline) flushBlock();
    node.children.forEach(walk);
    if (!isInline) flushBlock();
  };

  nodes.forEach(walk);
  flushBlock();
  return result;
}

/** One run of consecutive text in a block written by the same author. */
export interface AuthoredPassage {
  author: string;
  ai: boolean;
  text: string;
}

/**
 * The document's text split into passages per author, in reading order:
 * consecutive leaves of one block by the same author (and same AI flag) are
 * merged. Unattributed text is skipped. Used to show "what each
 * collaborator wrote".
 */
export function authoredPassages(nodes: any[]): AuthoredPassage[] {
  const out: AuthoredPassage[] = [];
  let current: AuthoredPassage | null = null;
  const close = () => {
    if (current && current.text.trim())
      out.push({ ...current, text: current.text.replace(/\s+/g, " ").trim() });
    current = null;
  };
  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (typeof node.text === "string") {
      if (typeof node.author !== "string") {
        // Whitespace-only legacy text doesn't break a passage.
        if (node.text.trim()) close();
        else if (current) current.text += node.text;
        return;
      }
      const ai = node.ai === true;
      if (current && current.author === node.author && current.ai === ai)
        current.text += node.text;
      else {
        close();
        current = { author: node.author, ai, text: node.text };
      }
      return;
    }
    if (!Array.isArray(node.children)) return;
    const isInline = node.type === "a";
    if (!isInline) close();
    node.children.forEach(walk);
    if (!isInline) close();
  };
  nodes.forEach(walk);
  close();
  return out;
}

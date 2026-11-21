/**
 * Cleanup applied to AI output before it lands in the writer's document.
 * Pure functions, kept out of PlateEditor.tsx so they can be unit tested
 * (src/lib/aiText.test.ts).
 */

/**
 * Strips what mcp-sre's chat answers append for its own chat UI but must
 * not land in an article: reference markers (`[G-8f04]`, `[1] [2] …`) and
 * LangChain metadata leaking as ` additional_kwargs=…`. Line breaks are
 * kept (structure generation returns multi-line markdown).
 */
export function cleanAIText(text: string): string {
  let out = text;
  const metadataStart = out.indexOf(" additional_kwargs=");
  if (metadataStart !== -1) out = out.slice(0, metadataStart);
  out = out.replace(/[ \t]*\[(?:G-[^\]]+|\d+)\]/g, "");
  out = out.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+\n/g, "\n");
  return out.trim();
}

/**
 * When asked to continue a text, the model often repeats it (or its last
 * sentence) before writing the continuation — appended after the original,
 * that would show the same sentence twice. Drops such an echoed prefix.
 */
export function stripEchoedPrefix(aiText: string, existing: string): string {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  const ai = norm(aiText);
  const before = norm(existing);
  if (!before) return ai;
  if (ai.toLowerCase().startsWith(before.toLowerCase())) return ai.slice(before.length).trim();
  const sentences = before.split(/(?<=[.!?])\s+/);
  const last = sentences[sentences.length - 1];
  if (last && last.length >= 15 && ai.toLowerCase().startsWith(last.toLowerCase())) {
    return ai.slice(last.length).trim();
  }
  return ai;
}

/** Text of a generated line or a block, for comparing: no markdown, numbering or punctuation. */
export function lineKey(text: string): string {
  return text
    .replace(/^#+\s*/, "")
    .replace(/^[\*\-]\s+/, "")
    // "1.", "2.1", "BAB I", "IV." — a Roman numeral only with "bab" or a dot,
    // so a word like "Civil" is not taken for one.
    .replace(/^(?:bab\s+[\dIVXLC]+|\d+(?:\.\d+)*|[IVXLC]+\.)[.)]?\s+/i, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The model often repeats what is already in the editor (the heading it was
 * asked to fill, an existing paragraph) or says the same line twice. Inserted
 * as-is, that shows up twice in the document. Drops generated lines that are
 * already in `existing` (the document's blocks) or earlier in the output.
 */
export function dropRepeatedLines(lines: string[], existing: string[]): string[] {
  const seen = new Set(existing.map(lineKey).filter(Boolean));
  return lines.filter((line) => {
    const key = lineKey(line);
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

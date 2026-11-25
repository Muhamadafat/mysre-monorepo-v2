/**
 * What a Daftar Pustaka entry may show to readers.
 *
 * A reference made from an uploaded PDF carries the file's link on brain
 * (…/uploads/<name>-<timestamp>.pdf). That is the app's own storage, not
 * where a reader can find the source, so it never goes in the citation
 * ("Retrieved from …") or the RIS export. Its title can also be the file
 * name when the PDF had no metadata: the ".pdf" is dropped.
 */

/** A file uploaded to brain (or the writer): an internal link, not a source URL. */
export function isUploadedFileUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url, "http://x").pathname.includes("/uploads/");
  } catch {
    return false;
  }
}

/** The URL to cite: undefined for uploaded files. */
export function citableUrl(url: string | null | undefined): string | undefined {
  const trimmed = url?.trim();
  return trimmed && !isUploadedFileUrl(trimmed) ? trimmed : undefined;
}

/** "Some paper.pdf" → "Some paper" (titles taken from the file name). */
export function cleanReferenceTitle(title: string): string {
  return title.replace(/\.pdf\s*$/i, "").replace(/\s{2,}/g, " ").trim() || title;
}

/**
 * The formatted Daftar Pustaka marks italics Markdown-style ("*Title*", as
 * APA italicises titles and journals). These turn that into what is shown
 * or copied, so the asterisks themselves never reach the reader.
 */
export interface TextPart {
  text: string;
  italic: boolean;
}

const ITALIC = /\*([^*\n]+)\*/g;

/** "A. *Title*. B" → [{A.}, {Title, italic}, {. B}] */
export function italicParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(ITALIC)) {
    if (m.index! > last) parts.push({ text: text.slice(last, m.index), italic: false });
    parts.push({ text: m[1], italic: true });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), italic: false });
  return parts;
}

/** Plain text: the asterisks dropped. */
export function stripItalicMarks(text: string): string {
  return text.replace(ITALIC, "$1");
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** HTML for the clipboard (Word / Google Docs keep the italics); blank lines → paragraphs. */
export function italicHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map(
      (para) =>
        `<p>${italicParts(para)
          .map((p) => (p.italic ? `<i>${escapeHtml(p.text)}</i>` : escapeHtml(p.text)))
          .join("")
          .replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

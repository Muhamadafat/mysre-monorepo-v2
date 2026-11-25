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

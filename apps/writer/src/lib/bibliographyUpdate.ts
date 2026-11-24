/**
 * Keeping the Daftar Pustaka in step with Referensi Pustaka changes.
 *
 * The Daftar Pustaka holds its OWN copy of each cited article's details
 * (localStorage + every "Simpan Versi"), linked by `sourceId` = article id.
 * Citations in the text are just "[n]" and point at the entry's `number`.
 * So these helpers may only touch details — never `number`, `id` or the
 * order — or citations would end up pointing at the wrong source.
 */

export interface BibEntryLike {
  id: string;
  sourceId?: string;
  number: number;
  title: string;
  author: string;
  year: string;
  doi?: string;
  url?: string;
}

export interface EditedReference {
  id: string;
  title: string;
  author: string | null;
  year: string | null;
  doi: string | null;
}

const DOI_LINK = /^https?:\/\/(dx\.)?doi\.org\//i;

/** Corrected article details → its entries. Same fallbacks as "Cite". */
export function applyEditToBibliography<T extends BibEntryLike>(list: T[], updated: EditedReference): T[] {
  let changed = false;
  const next = list.map((b) => {
    if (b.sourceId !== updated.id) return b;
    changed = true;
    const doi = updated.doi?.trim() || undefined;
    // The link follows the DOI only when it was a DOI link (not a PDF/web URL).
    const wasDoiLink = !b.url || DOI_LINK.test(b.url);
    return {
      ...b,
      title: updated.title?.trim() || b.title,
      author: updated.author?.trim() || "Tanpa nama penulis",
      year: updated.year?.trim() || "t.t.",
      doi,
      url: wasDoiLink ? (doi ? `https://doi.org/${doi}` : b.url) : b.url,
    };
  });
  return changed ? next : list; // same array when nothing matched: no re-render, no save
}

/** "Lampirkan PDF" gives the reference a new article id: keep its entries linked. */
export function remapBibliographySource<T extends BibEntryLike>(list: T[], fromId: string, toId: string): T[] {
  if (!list.some((b) => b.sourceId === fromId)) return list;
  return list.map((b) => (b.sourceId === fromId ? { ...b, sourceId: toId } : b));
}

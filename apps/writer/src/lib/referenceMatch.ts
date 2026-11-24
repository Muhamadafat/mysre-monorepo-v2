/**
 * Finds the reference a spoken command means ("kutip referensi website
 * design", "hapus referensi Rahman 2023", "edit referensi nomor dua").
 * Speech-to-text rarely gives the exact title, so the query is scored by
 * word overlap with title / author / year; "nomor N" / "ke-N" / "pertama"
 * picks the N-th card of the list as shown.
 */

export interface MatchableReference {
  /** Article id (what edit/delete/cite act on). */
  id: string;
  title: string;
  author?: string | null;
  year?: string | null;
}

export type ReferenceMatch<T extends MatchableReference> =
  | { kind: "found"; ref: T }
  | { kind: "ambiguous"; candidates: T[] }
  | { kind: "none" };

const ORDINALS: Record<string, number> = {
  pertama: 1, kesatu: 1, satu: 1,
  kedua: 2, dua: 2,
  ketiga: 3, tiga: 3,
  keempat: 4, empat: 4,
  kelima: 5, lima: 5,
  keenam: 6, enam: 6,
  ketujuh: 7, tujuh: 7,
  kedelapan: 8, delapan: 8,
  kesembilan: 9, sembilan: 9,
  kesepuluh: 10, sepuluh: 10,
};

/** Words that say nothing about which reference is meant. */
const FILLER = new Set([
  "referensi", "artikel", "jurnal", "paper", "pustaka", "yang", "judul", "judulnya", "berjudul", "tentang",
  "dari", "oleh", "karya", "the", "a", "an", "of", "and", "for", "in", "on", "to", "dan", "di", "ke",
  "itu", "ini", "nomor", "no", "urutan", "tolong", "dong", "ya",
]);

export const normalizeWords = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // accents (é → e)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/** "nomor 2", "ke-3", "yang kedua", "terakhir" → 1-based position (or -1 for last). */
export function positionFromQuery(query: string): number | null {
  const q = query.toLowerCase();
  if (/\bterakhir\b/.test(q)) return -1;
  const num = q.match(/\b(?:nomor|no\.?|urutan|ke-?)\s*(\d{1,3})\b/);
  if (num) return Number(num[1]);
  const words = normalizeWords(q).filter(w => w !== "yang" && w !== "referensi" && w !== "artikel" && w !== "nomor");
  if (words.length === 1 && ORDINALS[words[0]]) return ORDINALS[words[0]];
  const ordinal = normalizeWords(q).find(w => w.startsWith("ke") && ORDINALS[w]);
  return ordinal ? ORDINALS[ordinal] : null;
}

function score(ref: MatchableReference, words: string[]): number {
  const title = new Set(normalizeWords(ref.title));
  const author = new Set(normalizeWords(ref.author ?? ""));
  const year = (ref.year ?? "").trim();
  let points = 0;
  for (const w of words) {
    if (/^\d{4}$/.test(w)) points += year === w ? 2 : 0;
    else if (title.has(w)) points += 1;
    else if (author.has(w)) points += 1.5; // surnames are rare words: strong signal
    else if (w.length >= 5 && [...title].some(t => t.startsWith(w.slice(0, 5)))) points += 0.5; // STT: "desain" ~ "design"
  }
  return points;
}

export function matchReference<T extends MatchableReference>(query: string, refs: T[]): ReferenceMatch<T> {
  if (!refs.length) return { kind: "none" };
  const position = positionFromQuery(query);
  if (position !== null) {
    const ref = position === -1 ? refs[refs.length - 1] : refs[position - 1];
    return ref ? { kind: "found", ref } : { kind: "none" };
  }

  const words = normalizeWords(query).filter(w => !FILLER.has(w));
  if (!words.length) return refs.length === 1 ? { kind: "found", ref: refs[0] } : { kind: "ambiguous", candidates: refs.slice(0, 5) };

  const scored = refs.map(ref => ({ ref, points: score(ref, words) })).filter(s => s.points > 0);
  if (!scored.length) return { kind: "none" };
  scored.sort((a, b) => b.points - a.points);
  const best = scored[0].points;
  // Needs at least half the meaningful words to match, unless it's the only hit.
  if (best < Math.min(words.length, 2) / 2 && scored.length > 1) return { kind: "none" };
  const tied = scored.filter(s => s.points === best);
  if (tied.length === 1) return { kind: "found", ref: tied[0].ref };
  return { kind: "ambiguous", candidates: tied.slice(0, 5).map(s => s.ref) };
}

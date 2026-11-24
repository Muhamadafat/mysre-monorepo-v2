/**
 * Daftar Pustaka → RIS (Research Information Systems) export, the plain-text
 * format Zotero, Mendeley, EndNote and most reference managers import.
 * Spec: each record starts with `TY  - <type>` and ends with `ER  - `;
 * every tag line is `XX  - value` (two letters, two spaces, dash, space).
 */

export interface RisSource {
  number?: number;
  author?: string;
  title?: string;
  year?: string;
  publisher?: string;
  url?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  accessDate?: string;
  doi?: string;
  edition?: string;
  city?: string;
  conference?: string;
  type?: string;
}

/** One line per tag, newlines inside values flattened. */
function tag(code: string, value: string | undefined | null): string[] {
  const v = (value ?? "").replace(/\s+/g, " ").trim();
  return v ? [`${code}  - ${v}`] : [];
}

/** "A, B & C" / "A; B" / "A and B" → one AU line each. Keeps "Last, First". */
export function splitAuthors(raw: string | undefined): string[] {
  const s = (raw ?? "").trim();
  if (!s || /^tanpa nama penulis$/i.test(s)) return [];
  if (s.includes(";")) return s.split(";").map((a) => a.trim()).filter(Boolean);
  const parts = s
    .split(/\s*(?:&|\band\b|\bdan\b)\s*/i)
    .flatMap((p) => {
      // "Smith, J., Doe, A." → ["Smith, J.", "Doe, A."]; a lone "Smith, John" stays one author.
      const pieces = p.split(/,\s*/).filter(Boolean);
      if (pieces.length >= 4 && pieces.length % 2 === 0) {
        const out: string[] = [];
        for (let i = 0; i < pieces.length; i += 2) out.push(`${pieces[i]}, ${pieces[i + 1]}`);
        return out;
      }
      return [p.replace(/,\s*$/, "")];
    })
    .map((a) => a.trim())
    .filter(Boolean);
  return parts;
}

function risType(item: RisSource): string {
  const t = (item.type ?? "").toLowerCase();
  if (t.includes("book")) return "BOOK";
  if (t.includes("conf") || item.conference) return "CONF";
  if (t.includes("web") || t.includes("online")) return "ELEC";
  if (item.journal) return "JOUR";
  if (item.publisher || item.edition) return "BOOK";
  if (item.url && !item.doi) return "ELEC";
  return "GEN";
}

export function itemToRis(item: RisSource): string {
  const lines: string[] = [`TY  - ${risType(item)}`];
  for (const a of splitAuthors(item.author)) lines.push(...tag("AU", a));
  lines.push(...tag("TI", item.title));
  const year = (item.year ?? "").match(/\d{4}/)?.[0];
  lines.push(...tag("PY", year));
  lines.push(...tag("T2", item.journal || item.conference));
  lines.push(...tag("VL", item.volume));
  lines.push(...tag("IS", item.issue));
  const pages = (item.pages ?? "").trim();
  if (pages) {
    const [sp, ep] = pages.split(/\s*[-–—]\s*/);
    lines.push(...tag("SP", sp));
    lines.push(...tag("EP", ep));
  }
  lines.push(...tag("PB", item.publisher));
  lines.push(...tag("CY", item.city));
  lines.push(...tag("ET", item.edition));
  const doi = (item.doi ?? "").replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim();
  lines.push(...tag("DO", doi));
  lines.push(...tag("UR", item.url || (doi ? `https://doi.org/${doi}` : "")));
  lines.push(...tag("Y2", item.accessDate));
  if (item.number != null) lines.push(...tag("N1", `Sitasi [${item.number}]`));
  lines.push("ER  - ");
  return lines.join("\r\n");
}

/** The whole list, ordered by citation number, as one .ris file body. */
export function bibliographyToRis(items: RisSource[]): string {
  return [...items]
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
    .map(itemToRis)
    .join("\r\n\r\n") + "\r\n";
}

/** Safe file name from the article title. */
export function risFileName(title: string | undefined): string {
  const base = (title ?? "")
    .replace(/^📝\s*/u, "")
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${base || "daftar-pustaka"}.ris`;
}

/** Browser download (works on mobile Safari/Chrome too). */
export function downloadRis(items: RisSource[], title?: string): void {
  const blob = new Blob([bibliographyToRis(items)], { type: "application/x-research-info-systems" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = risFileName(title);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ───────────────────────────── RIS import ─────────────────────────────

/** One reference read from a .ris file, in the shape the upload form uses. */
export interface RisRecord {
  type: string;
  title: string;
  authors: string[];
  year: string;
  doi: string;
  abstract: string;
  keywords: string[];
  journal: string;
  url: string;
}

const TAG_LINE = /^([A-Z][A-Z0-9])  ?- ?(.*)$/;

/**
 * Parses a .ris export (Zotero, Mendeley, EndNote, Google Scholar, publisher
 * sites). Tolerant of BOMs, CRLF, missing ER lines and continuation lines.
 */
export function parseRis(text: string): RisRecord[] {
  const records: RisRecord[] = [];
  let cur: Record<string, string[]> | null = null;
  let lastTag = "";
  const finish = () => {
    if (cur) {
      const rec = toRecord(cur);
      if (rec.title || rec.authors.length || rec.doi) records.push(rec);
    }
    cur = null;
    lastTag = "";
  };
  for (const raw of text.replace(/^﻿/, "").split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "");
    const m = line.match(TAG_LINE);
    if (!m) {
      // Continuation of the previous value (long abstracts get wrapped).
      if (cur && lastTag && line.trim()) {
        const list: string[] = cur[lastTag];
        list[list.length - 1] += ` ${line.trim()}`;
      }
      continue;
    }
    const [, tag, value] = m;
    if (tag === "TY") {
      finish();
      cur = { TY: [value.trim()] };
      lastTag = "TY";
      continue;
    }
    if (tag === "ER") {
      finish();
      continue;
    }
    if (!cur) cur = {};
    (cur[tag] ||= []).push(value.trim());
    lastTag = tag;
  }
  finish();
  return records;
}

function toRecord(tags: Record<string, string[]>): RisRecord {
  const first = (...keys: string[]) => {
    for (const k of keys) {
      const v = tags[k]?.find((x) => x.trim());
      if (v) return v.trim();
    }
    return "";
  };
  const all = (...keys: string[]) => keys.flatMap((k) => tags[k] ?? []).map((x) => x.trim()).filter(Boolean);
  const doi = first("DO", "DI", "M3")
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "");
  return {
    type: first("TY") || "GEN",
    title: first("TI", "T1", "CT", "BT"),
    authors: all("AU", "A1", "A2", "A3", "A4"),
    year: first("PY", "Y1", "DA", "Y2").match(/\d{4}/)?.[0] ?? "",
    doi: /^10\.\S+\/\S+/.test(doi) ? doi : "",
    abstract: first("AB", "N2"),
    keywords: all("KW").flatMap((k) => k.split(/\s*;\s*/)).filter(Boolean),
    journal: first("T2", "JO", "JF", "JA", "J2"),
    url: first("UR", "L2"),
  };
}

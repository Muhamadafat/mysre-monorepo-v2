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

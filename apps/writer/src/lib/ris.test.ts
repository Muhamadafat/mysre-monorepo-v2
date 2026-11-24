import { describe, expect, it } from "vitest";
import { bibliographyToRis, itemToRis, risFileName, splitAuthors } from "./ris";

describe("RIS export", () => {
  it("writes a journal article with every tag in RIS syntax", () => {
    const ris = itemToRis({
      number: 1,
      author: "Smith, J., Doe, A.",
      title: "Belajar\nmenulis",
      year: "2023",
      journal: "Jurnal Riset",
      volume: "4",
      issue: "2",
      pages: "10-20",
      doi: "https://doi.org/10.1/abc",
    });
    const lines = ris.split("\r\n");
    expect(lines[0]).toBe("TY  - JOUR");
    expect(lines).toContain("AU  - Smith, J.");
    expect(lines).toContain("AU  - Doe, A.");
    expect(lines).toContain("TI  - Belajar menulis");
    expect(lines).toContain("SP  - 10");
    expect(lines).toContain("EP  - 20");
    expect(lines).toContain("DO  - 10.1/abc");
    expect(lines).toContain("UR  - https://doi.org/10.1/abc");
    expect(lines.at(-1)).toBe("ER  - ");
  });

  it("skips the placeholder author and odd years", () => {
    const ris = itemToRis({ author: "Tanpa nama penulis", title: "X", year: "t.t." });
    expect(ris).not.toContain("AU  -");
    expect(ris).not.toContain("PY  -");
  });

  it("splits common author separators", () => {
    expect(splitAuthors("A & B")).toEqual(["A", "B"]);
    expect(splitAuthors("Smith, John")).toEqual(["Smith, John"]);
    expect(splitAuthors("A; B; C")).toEqual(["A", "B", "C"]);
  });

  it("orders records by citation number", () => {
    const out = bibliographyToRis([
      { number: 2, title: "Dua" },
      { number: 1, title: "Satu" },
    ]);
    expect(out.indexOf("Satu")).toBeLessThan(out.indexOf("Dua"));
  });

  it("makes a safe file name", () => {
    expect(risFileName("📝 Tidak: ada/judul?")).toBe("Tidak adajudul.ris");
    expect(risFileName("")).toBe("daftar-pustaka.ris");
  });
});

describe("RIS import", () => {
  it("reads a Zotero-style record with wrapped abstract and several authors", async () => {
    const { parseRis } = await import("./ris");
    const text = "﻿TY  - JOUR\r\nAU  - Rahman, Ahmad\r\nAU  - Sari, Dewi\r\nTI  - Energi Surya di Desa\r\nT2  - Jurnal Energi\r\nPY  - 2023/05/01/\r\nDO  - https://doi.org/10.1234/je.2023.7\r\nAB  - Penelitian ini membahas\r\n  panel surya.\r\nKW  - energi; surya\r\nKW  - desa\r\nER  - \r\n";
    const [rec] = parseRis(text);
    expect(rec.title).toBe("Energi Surya di Desa");
    expect(rec.authors).toEqual(["Rahman, Ahmad", "Sari, Dewi"]);
    expect(rec.year).toBe("2023");
    expect(rec.doi).toBe("10.1234/je.2023.7");
    expect(rec.abstract).toBe("Penelitian ini membahas panel surya.");
    expect(rec.keywords).toEqual(["energi", "surya", "desa"]);
    expect(rec.journal).toBe("Jurnal Energi");
  });

  it("reads several records and Mendeley's T1/A1/Y1 tags", async () => {
    const { parseRis } = await import("./ris");
    const text = "TY  - JOUR\nT1  - Satu\nA1  - A, B\nY1  - 2020\nER  -\n\nTY  - BOOK\nTI  - Dua\nER  -\n";
    const recs = parseRis(text);
    expect(recs.map((r) => r.title)).toEqual(["Satu", "Dua"]);
    expect(recs[0].year).toBe("2020");
    expect(recs[0].authors).toEqual(["A, B"]);
  });

  it("round-trips its own export", async () => {
    const { parseRis, bibliographyToRis } = await import("./ris");
    const [rec] = parseRis(bibliographyToRis([{ number: 1, author: "Doe, J.", title: "Judul", year: "2021", journal: "J", doi: "10.1/x" }]));
    expect(rec).toMatchObject({ title: "Judul", year: "2021", doi: "10.1/x", authors: ["Doe, J."] });
  });

  it("ignores files that are not RIS", async () => {
    const { parseRis } = await import("./ris");
    expect(parseRis("%PDF-1.4 bukan ris")).toEqual([]);
  });
});

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

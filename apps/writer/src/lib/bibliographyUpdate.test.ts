import { describe, expect, it } from "vitest";
import { applyEditToBibliography, remapBibliographySource } from "./bibliographyUpdate";

const list = [
  { id: "e1", sourceId: "art-1", number: 1, title: "Old title", author: "Tanpa nama penulis", year: "t.t.", url: "https://doi.org/10.1/old", doi: "10.1/old" },
  { id: "e2", sourceId: "art-2", number: 2, title: "Other", author: "Putri, S.", year: "2021", url: "http://x/uploads/a.pdf" },
  { id: "e3", number: 3, title: "Manual entry", author: "Budi", year: "2020" },
];

describe("applyEditToBibliography", () => {
  it("updates only the entry of the edited article, keeping number, id and order", () => {
    const next = applyEditToBibliography(list, { id: "art-1", title: "New title", author: "Rahman, A.", year: "2023", doi: "10.1/new" });
    expect(next.map((b) => [b.id, b.number])).toEqual([["e1", 1], ["e2", 2], ["e3", 3]]);
    expect(next[0]).toMatchObject({ title: "New title", author: "Rahman, A.", year: "2023", doi: "10.1/new", url: "https://doi.org/10.1/new" });
    expect(next[1]).toBe(list[1]);
    expect(next[2]).toBe(list[2]);
  });

  it("keeps a PDF/web link when the DOI changes", () => {
    const next = applyEditToBibliography(list, { id: "art-2", title: "Other", author: "Putri, S.", year: "2021", doi: "10.9/x" });
    expect(next[1].url).toBe("http://x/uploads/a.pdf");
    expect(next[1].doi).toBe("10.9/x");
  });

  it("uses the same fallbacks as Cite for cleared fields", () => {
    const next = applyEditToBibliography(list, { id: "art-2", title: "Other", author: "", year: null, doi: null });
    expect(next[1]).toMatchObject({ author: "Tanpa nama penulis", year: "t.t.", doi: undefined });
  });

  it("returns the same list when the article isn't cited", () => {
    expect(applyEditToBibliography(list, { id: "art-9", title: "x", author: null, year: null, doi: null })).toBe(list);
  });
});

describe("remapBibliographySource", () => {
  it("moves entries to the new article id without touching numbers", () => {
    const next = remapBibliographySource(list, "art-1", "art-1b");
    expect(next[0]).toMatchObject({ id: "e1", number: 1, sourceId: "art-1b", title: "Old title" });
    expect(next[1]).toBe(list[1]);
  });

  it("returns the same list when nothing points at the old id", () => {
    expect(remapBibliographySource(list, "nope", "x")).toBe(list);
  });
});

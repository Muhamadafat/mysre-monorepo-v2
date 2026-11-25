import { describe, expect, it } from "vitest";
import { citableUrl, cleanReferenceTitle, isUploadedFileUrl, italicHtml, italicParts, stripItalicMarks } from "./referenceText";

describe("referenceText", () => {
  it("treats uploaded PDFs as internal links", () => {
    expect(isUploadedFileUrl("http://brain.lvh.me:3001/uploads/Paper-1790863205534.pdf")).toBe(true);
    expect(isUploadedFileUrl("https://brain.riset.web.id/uploads/a.pdf")).toBe(true);
    expect(isUploadedFileUrl("/uploads/a.pdf")).toBe(true);
    expect(isUploadedFileUrl("https://doi.org/10.1/x")).toBe(false);
    expect(isUploadedFileUrl(undefined)).toBe(false);
  });

  it("only cites real source URLs", () => {
    expect(citableUrl("http://brain.lvh.me:3001/uploads/a.pdf")).toBeUndefined();
    expect(citableUrl("https://doi.org/10.1/x")).toBe("https://doi.org/10.1/x");
    expect(citableUrl("  ")).toBeUndefined();
  });

  it("drops .pdf from file-name titles", () => {
    expect(cleanReferenceTitle("Enhancing EFL students  academic writing.pdf")).toBe("Enhancing EFL students academic writing");
    expect(cleanReferenceTitle("A normal title")).toBe("A normal title");
  });
});

describe("italic marks in the Daftar Pustaka", () => {
  const entry = "Sadri (2026). *A Comparative Study*. *Jurnal X*, 4(2).";

  it("splits text into plain and italic parts", () => {
    expect(italicParts(entry)).toEqual([
      { text: "Sadri (2026). ", italic: false },
      { text: "A Comparative Study", italic: true },
      { text: ". ", italic: false },
      { text: "Jurnal X", italic: true },
      { text: ", 4(2).", italic: false },
    ]);
    expect(italicParts("no marks")).toEqual([{ text: "no marks", italic: false }]);
  });

  it("copies as plain text without asterisks", () => {
    expect(stripItalicMarks(entry)).toBe("Sadri (2026). A Comparative Study. Jurnal X, 4(2).");
  });

  it("copies as HTML with <i> and one paragraph per entry", () => {
    expect(italicHtml("[1] *A* & b\n\n[2] c")).toBe("<p>[1] <i>A</i> &amp; b</p><p>[2] c</p>");
  });
});

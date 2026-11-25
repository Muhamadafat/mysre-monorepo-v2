import { describe, expect, it } from "vitest";
import { citableUrl, cleanReferenceTitle, isUploadedFileUrl } from "./referenceText";

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

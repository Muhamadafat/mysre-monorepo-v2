import { describe, expect, it } from "vitest";
import { matchReference, positionFromQuery } from "./referenceMatch";

const refs = [
  { id: "a", title: "A literature review: website design and user engagement", author: "Garett, R.; Chiu, J.", year: "2016" },
  { id: "b", title: "Deep learning for solar energy forecasting", author: "Rahman, A.", year: "2023" },
  { id: "c", title: "Solar energy adoption in rural villages", author: "Putri, S.", year: "2021" },
];

describe("matchReference", () => {
  it("finds a reference from part of its title", () => {
    expect(matchReference("website design", refs)).toEqual({ kind: "found", ref: refs[0] });
    expect(matchReference("referensi tentang user engagement", refs)).toEqual({ kind: "found", ref: refs[0] });
  });

  it("uses author and year", () => {
    expect(matchReference("Rahman 2023", refs)).toEqual({ kind: "found", ref: refs[1] });
    expect(matchReference("artikel solar energy 2021", refs)).toEqual({ kind: "found", ref: refs[2] });
  });

  it("tolerates Indonesian spelling from speech-to-text", () => {
    expect(matchReference("desain website", refs)).toEqual({ kind: "found", ref: refs[0] });
  });

  it("reports ties instead of guessing", () => {
    const res = matchReference("solar energy", refs);
    expect(res.kind).toBe("ambiguous");
    if (res.kind === "ambiguous") expect(res.candidates.map(r => r.id).sort()).toEqual(["b", "c"]);
  });

  it("picks by position", () => {
    expect(matchReference("nomor 2", refs)).toEqual({ kind: "found", ref: refs[1] });
    expect(matchReference("yang ketiga", refs)).toEqual({ kind: "found", ref: refs[2] });
    expect(matchReference("referensi terakhir", refs)).toEqual({ kind: "found", ref: refs[2] });
    expect(matchReference("nomor 9", refs)).toEqual({ kind: "none" });
  });

  it("returns none when nothing matches", () => {
    expect(matchReference("blockchain supply chain", refs)).toEqual({ kind: "none" });
    expect(matchReference("apa saja", [])).toEqual({ kind: "none" });
  });
});

describe("positionFromQuery", () => {
  it("reads numbers and ordinals", () => {
    expect(positionFromQuery("referensi nomor 4")).toBe(4);
    expect(positionFromQuery("ke-2")).toBe(2);
    expect(positionFromQuery("yang pertama")).toBe(1);
    expect(positionFromQuery("website design")).toBeNull();
  });
});

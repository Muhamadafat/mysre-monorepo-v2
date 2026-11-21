import { describe, expect, test } from "vitest";
import { cleanAIText, dropRepeatedLines, lineKey, stripEchoedPrefix } from "./aiText";

describe("dropRepeatedLines: hasil AI tidak boleh dobel di editor", () => {
  const document = ["Pengembangan Web Modern", "Pendahuluan", "Web berkembang pesat dalam satu dekade terakhir."];

  test("heading yang sudah ada di dokumen tidak dimasukkan lagi", () => {
    const ai = ["## Pendahuluan", "Penelitian ini membahas performa aplikasi web."];
    expect(dropRepeatedLines(ai, document)).toEqual(["Penelitian ini membahas performa aplikasi web."]);
  });

  test("heading H1, H2 dan H3 yang sama semuanya dikenali", () => {
    for (const heading of ["# Pendahuluan", "## Pendahuluan", "### Pendahuluan"]) {
      expect(dropRepeatedLines([heading], document)).toEqual([]);
    }
  });

  test("heading dengan nomor atau huruf besar berbeda tetap dianggap sama", () => {
    expect(dropRepeatedLines(["## 1. PENDAHULUAN", "## BAB I Pendahuluan"], document)).toEqual([]);
  });

  test("paragraf yang sudah ada di dokumen tidak dimasukkan lagi", () => {
    const ai = ["Web berkembang pesat dalam satu dekade terakhir.", "Kalimat baru."];
    expect(dropRepeatedLines(ai, document)).toEqual(["Kalimat baru."]);
  });

  test("baris yang muncul dua kali di hasil AI hanya dimasukkan sekali", () => {
    const ai = ["## Metode", "Isi metode.", "## Metode", "Isi metode."];
    expect(dropRepeatedLines(ai, [])).toEqual(["## Metode", "Isi metode."]);
  });

  test("heading baru yang belum ada tetap dimasukkan", () => {
    expect(dropRepeatedLines(["## Hasil dan Pembahasan"], document)).toEqual(["## Hasil dan Pembahasan"]);
  });

  test("baris kosong dibuang", () => {
    expect(dropRepeatedLines(["", "   ", "##", "Teks."], [])).toEqual(["Teks."]);
  });
});

describe("lineKey: cara membandingkan dua baris", () => {
  test("mengabaikan tanda markdown, nomor, tanda baca dan spasi", () => {
    expect(lineKey("## 2.1  Metode Penelitian:")).toBe(lineKey("Metode penelitian"));
    expect(lineKey("- Poin satu")).toBe("poin satu");
  });

  test("nomor Romawi dibuang, tapi kata biasa yang mirip tidak", () => {
    expect(lineKey("## IV. Hasil")).toBe("hasil");
    expect(lineKey("## Civil Engineering")).toBe("civil engineering");
  });
});

describe("stripEchoedPrefix: lanjutkan menulis tanpa mengulang kalimat", () => {
  test("AI mengulang seluruh teks lalu melanjutkan: ulangannya dibuang", () => {
    expect(stripEchoedPrefix("Web berkembang pesat. Hal ini didorong teknologi.", "Web berkembang pesat.")).toBe(
      "Hal ini didorong teknologi.",
    );
  });

  test("AI mengulang kalimat terakhir saja: ulangannya dibuang", () => {
    const existing = "Paragraf pertama. Kalimat terakhir yang cukup panjang.";
    expect(stripEchoedPrefix("Kalimat terakhir yang cukup panjang. Lanjutan.", existing)).toBe("Lanjutan.");
  });

  test("AI tidak mengulang: teks tetap utuh", () => {
    expect(stripEchoedPrefix("Lanjutan baru.", "Teks lama.")).toBe("Lanjutan baru.");
  });
});

describe("cleanAIText: sisa format chat dibuang", () => {
  test("penanda referensi [1] dan [G-xxxx] dibuang", () => {
    expect(cleanAIText("Web berkembang [1] pesat [G-8f04].")).toBe("Web berkembang pesat.");
  });

  test("metadata LangChain yang bocor dibuang", () => {
    expect(cleanAIText("Teks jawaban. additional_kwargs={'refusal': None}")).toBe("Teks jawaban.");
  });

  test("baris baru (struktur outline) dipertahankan", () => {
    expect(cleanAIText("# Judul\n## Bab")).toBe("# Judul\n## Bab");
  });
});

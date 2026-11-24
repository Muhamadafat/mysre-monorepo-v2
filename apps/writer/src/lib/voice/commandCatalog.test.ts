import { describe, expect, it } from "vitest";
import { COMMAND_CATALOG, describeCall } from "./commandCatalog";
import { VOICE_TOOLS } from "./tools";

describe("describeCall", () => {
  it("maps the four main commands", () => {
    expect(describeCall("generate_with_ai", { mode: "structure" }).intent).toBe("buat_outline_artikel");
    expect(describeCall("generate_with_ai", { mode: "structure", topic: "ML di pendidikan" }).intent).toBe("buat_outline_artikel");
    expect(describeCall("generate_with_ai", { mode: "content", topic: "metodologi" }).intent).toBe("isi_konten_artikel");
    expect(describeCall("continue_writing").intent).toBe("lanjutkan_paragraf");
    expect(describeCall("rewrite_paragraph", { instruction: "parafrasekan" }).intent).toBe("parafrasekan_paragraf");
    expect(describeCall("generate_with_ai", { mode: "structure" }).target).toBe("jendela_ai");
  });

  it("tells the other rewrite intents apart by instruction", () => {
    expect(describeCall("rewrite_paragraph", { instruction: "terjemahkan ke bahasa Inggris" }).intent).toBe("terjemahkan_paragraf");
    expect(describeCall("rewrite_paragraph", { instruction: "persingkat" }).intent).toBe("persingkat_paragraf");
    expect(describeCall("rewrite_paragraph", { instruction: "buat lebih formal" }).intent).toBe("perbaiki_paragraf");
  });

  it("covers insert confirmation, go_to and add_block variants", () => {
    expect(describeCall("insert_generated_content", { confirmed: true }).target).toBe("dokumen_seluruh");
    expect(describeCall("insert_generated_content", {}).intent).toBe("masukkan_hasil");
    expect(describeCall("go_to", { target: "akhir" }).intent).toBe("ke_awal_akhir_dokumen");
    expect(describeCall("go_to", { target: "Pendahuluan" }).intent).toBe("pindah_ke_bagian");
    expect(describeCall("add_block", { kind: "heading", text: "Tinjauan Pustaka" }).intent).toBe("tambah_judul");
    expect(describeCall("add_block", { kind: "paragraph" }).intent).toBe("tambah_paragraf");
  });

  it("still describes runs of switched-off tools, and null for unknown ones", () => {
    expect(describeCall("generate_with_ai", { mode: "sentence" }).intent).toBe("kalimat_lanjutan");
    expect(describeCall("write_freely").intent).toBe("tulis_bebas");
    expect(describeCall("delete_everything").intent).toBeNull();
  });

  it("has an active row for every enabled voice tool, and none for disabled ones", () => {
    const active = new Set(COMMAND_CATALOG.filter(row => row.group !== "nonaktif").map(row => row.tool));
    const enabled = new Set<string>(VOICE_TOOLS.map(tool => tool.name));
    expect([...active].sort()).toEqual([...enabled].sort());
  });

  it("maps the Referensi Pustaka commands", () => {
    expect(describeCall("cite_reference", { reference: "website design" }).intent).toBe("kutip_referensi");
    expect(describeCall("cite_reference", { reference: "nomor 2" }).target).toBe("dokumen_kursor");
    expect(describeCall("edit_reference", { reference: "Rahman 2023" }).intent).toBe("edit_referensi");
    expect(describeCall("delete_reference", { reference: "yang terakhir" }).intent).toBe("hapus_referensi");
    expect(describeCall("delete_reference", { reference: "x" }).target).toBe("referensi_popup");
  });

  it("names the editor function and executor of every call", () => {
    for (const row of COMMAND_CATALOG) expect(row.fn.trim()).not.toBe("");
    const outline = describeCall("generate_with_ai", { mode: "structure" });
    expect(outline.function).toBe('handleAIGenerationWithProgress(topic, "structure")');
    expect(outline.executor).toContain("runVoiceCommand");
    expect(describeCall("accept_ai_text").function).toBe("acceptAIContent()");
    expect(describeCall("delete_everything").function).toBeNull();
  });

  it("uses unique intent ids", () => {
    const ids = COMMAND_CATALOG.map(row => row.intent);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

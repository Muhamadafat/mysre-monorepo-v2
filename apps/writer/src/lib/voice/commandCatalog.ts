/**
 * Intent catalog for Mode Perintah: which spoken command (intent) a tool call
 * is, what it does in SRE, and where its result goes. Mirrors
 * docs/daftar-perintah-suara.xlsx row for row (updated 2026-11-17); when the
 * sheet changes, change the rows here.
 *
 * Every tool call is executed by runVoiceCommand(name, args) in
 * src/components/PlateEditor.tsx; `fn` names the function it calls there.
 *
 * Each logged run stores tool + args plus the intent / function found here at
 * that moment (see CommandRun in recordingKeys.ts); the recordings API looks
 * them up again when reading, so an edited catalog applies to old runs too.
 */

/** Where every tool call runs (the dispatcher). */
export const COMMAND_EXECUTOR = "runVoiceCommand(name, args) — src/components/PlateEditor.tsx";

/** Where an action's result ends up. */
export type CommandTarget =
  | "jendela_ai"
  | "dokumen_kursor"
  | "dokumen_bawah_paragraf"
  | "dokumen_bawah_kursor"
  | "dokumen_seluruh"
  | "dokumen_teks_ai"
  | "dokumen_riwayat"
  | "kursor"
  | "notifikasi";

export const TARGET_LABEL: Record<CommandTarget, string> = {
  jendela_ai: "Jendela AI (pratinjau, belum masuk dokumen)",
  dokumen_kursor: "Dokumen, di posisi kursor",
  dokumen_bawah_paragraf: "Dokumen, versi baru di bawah paragraf di kursor",
  dokumen_bawah_kursor: "Dokumen, blok baru di bawah kursor",
  dokumen_seluruh: "Dokumen, seluruh isi diganti",
  dokumen_teks_ai: "Dokumen, teks AI yang sedang menunggu",
  dokumen_riwayat: "Dokumen, riwayat perubahan (undo/redo)",
  kursor: "Posisi kursor / gulir halaman",
  notifikasi: "Notifikasi (tidak menulis ke dokumen)",
};

export interface CatalogEntry {
  /** Stable id of the intent, e.g. "buat_outline_artikel". */
  intent: string;
  /** "utama" = the four main commands; "pendukung" = the rest; "nonaktif" = switched off. */
  group: "utama" | "pendukung" | "nonaktif";
  /** Command name ("Perintah" column in the Excel sheet). */
  command: string;
  /** Example sentence. */
  example: string;
  /** Other ways to say it. */
  keywords: string;
  /** Tool the interpreter calls (tools.ts) — the "case" in runVoiceCommand. */
  tool: string;
  /** The editor function that does the work inside runVoiceCommand ("Function" column). */
  fn: string;
  /** "Aksi di SRE": what happens. */
  action: string;
  target: CommandTarget;
  /** Extra condition on the args when one tool serves several intents. */
  match?: (args: Record<string, unknown>) => boolean;
}

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const has = (value: unknown, pattern: RegExp) => pattern.test(str(value).toLowerCase());

const TRANSLATE = /terjemah|translate|bahasa (inggris|indonesia)/;
const LENGTH = /singkat|pendek|ringkas|panjang/;
const FORMAL = /formal|perbaik|tata bahasa|grammar|baku/;

/** Same rows, same order as the Excel sheet. First matching row wins. */
export const COMMAND_CATALOG: CatalogEntry[] = [
  // ---- Perintah utama ----
  {
    intent: "buat_outline_artikel",
    group: "utama",
    command: "Buat outline artikel",
    example: "Buat outline artikel",
    keywords: "buat outline, buat kerangka, susun outline (+ topik bila perlu)",
    tool: "generate_with_ai",
    fn: "handleAIGenerationWithProgress(topic, \"structure\")",
    match: args => str(args.mode) === "structure",
    action:
      "AI menyusun outline/kerangka artikel dari artikel referensi project (atau dari topik yang disebut) dan menampilkannya di jendela AI. Belum masuk dokumen sampai diucapkan 'masukkan hasilnya'.",
    target: "jendela_ai",
  },
  {
    intent: "isi_konten_artikel",
    group: "utama",
    command: "Isi konten artikel",
    example: "Isi konten artikel bagian metodologi",
    keywords: "isi konten, isikan bagian ini, isi bagian + nama bagian",
    tool: "generate_with_ai",
    fn: "handleAIGenerationWithProgress(topic, \"content\")",
    match: args => str(args.mode) === "content",
    action:
      "AI menulis isi untuk bagian/judul di posisi kursor (atau bagian yang disebut) sesuai outline dan artikel referensi; hasil tampil dulu di jendela AI.",
    target: "jendela_ai",
  },
  {
    intent: "lanjutkan_paragraf",
    group: "utama",
    command: "Lanjutkan paragraf",
    example: "Lanjutkan paragraf",
    keywords: "lanjutkan, lanjutkan menulis, terusin, tambah lagi",
    tool: "continue_writing",
    fn: "handleInlineAIAction(\"continue\")",
    action: "AI melanjutkan paragraf dari posisi kursor. Teks AI ditandai dan menunggu 'terima' atau 'batalkan'.",
    target: "dokumen_kursor",
  },
  {
    intent: "parafrasekan_paragraf",
    group: "utama",
    command: "Parafrasekan paragraf",
    example: "Parafrasekan paragraf ini",
    keywords: "parafrase, parafrasekan, tulis ulang paragraf",
    tool: "rewrite_paragraph",
    fn: "callMCPAPI(prompt, { mode: \"rewrite\" }) → typeText(hasil, paragrafBaru)",
    match: args => !has(args.instruction, TRANSLATE) && !has(args.instruction, LENGTH) && !has(args.instruction, FORMAL),
    action:
      "AI menulis versi baru paragraf di kursor tepat di bawah paragraf asli (sitasi dipertahankan). 'Terima' = versi baru menggantikan paragraf asli.",
    target: "dokumen_bawah_paragraf",
  },

  // ---- Perintah pendukung ----
  {
    intent: "masukkan_hasil",
    group: "pendukung",
    command: "Masukkan hasilnya",
    example: "Masukkan hasilnya",
    keywords: "masukkan, pakai hasilnya, taruh di dokumen",
    tool: "insert_generated_content",
    fn: "insertContentToEditor(\"content_cursor\")",
    match: args => args.confirmed !== true,
    action:
      "Hasil di jendela AI (isi konten) dimasukkan ke dokumen. Untuk outline, sistem meminta kalimat persetujuan dulu karena seluruh isi dokumen diganti.",
    target: "dokumen_kursor",
  },
  {
    intent: "ganti_dokumen_dengan_outline",
    group: "pendukung",
    command: "Setujui ganti dokumen dengan outline",
    example: "Ya, masukkan outline-nya dan ganti seluruh dokumen",
    keywords: "ya ganti semua, setuju ganti dokumen",
    tool: "insert_generated_content",
    fn: "insertContentToEditor(\"rewrite\")",
    action: "Outline di jendela AI menggantikan seluruh isi dokumen.",
    target: "dokumen_seluruh",
  },
  {
    intent: "tutup_jendela_ai",
    group: "pendukung",
    command: "Tutup jendela AI",
    example: "Tutup jendela AI",
    keywords: "tutup, tidak jadi, buang hasilnya",
    tool: "close_ai_window",
    fn: "closeModalAndReset()",
    action: "Jendela AI ditutup tanpa memasukkan hasil.",
    target: "jendela_ai",
  },
  {
    intent: "terima_teks_ai",
    group: "pendukung",
    command: "Terima",
    example: "Terima hasilnya",
    keywords: "terima, oke simpan, pakai itu",
    tool: "accept_ai_text",
    fn: "acceptAIContent()",
    action: "Teks AI yang menunggu disimpan ke dokumen. Untuk parafrase: versi baru menggantikan paragraf asli.",
    target: "dokumen_teks_ai",
  },
  {
    intent: "batalkan_teks_ai",
    group: "pendukung",
    command: "Batalkan",
    example: "Batalkan",
    keywords: "batalkan, buang, jangan pakai",
    tool: "reject_ai_text",
    fn: "revertAIContent()",
    action: "Teks AI yang menunggu dibuang; dokumen kembali seperti sebelumnya.",
    target: "dokumen_teks_ai",
  },
  {
    intent: "perbaiki_paragraf",
    group: "pendukung",
    command: "Perbaiki paragraf",
    example: "Perbaiki tata bahasa paragraf ini",
    keywords: "perbaiki, lebih formal, tata bahasa, bahasa baku",
    tool: "rewrite_paragraph",
    fn: "callMCPAPI(prompt, { mode: \"rewrite\" }) → typeText(hasil, paragrafBaru)",
    match: args => has(args.instruction, FORMAL) && !has(args.instruction, TRANSLATE),
    action: "Paragraf di kursor ditulis ulang lebih formal / tata bahasanya diperbaiki, sebagai versi baru di bawahnya.",
    target: "dokumen_bawah_paragraf",
  },
  {
    intent: "persingkat_paragraf",
    group: "pendukung",
    command: "Persingkat / perpanjang paragraf",
    example: "Persingkat paragraf ini",
    keywords: "persingkat, ringkas paragraf, perpanjang",
    tool: "rewrite_paragraph",
    fn: "callMCPAPI(prompt, { mode: \"rewrite\" }) → typeText(hasil, paragrafBaru)",
    match: args => has(args.instruction, LENGTH) && !has(args.instruction, TRANSLATE),
    action: "Paragraf di kursor ditulis ulang lebih singkat (atau lebih panjang jika diminta), sebagai versi baru di bawahnya.",
    target: "dokumen_bawah_paragraf",
  },
  {
    intent: "terjemahkan_paragraf",
    group: "pendukung",
    command: "Terjemahkan paragraf",
    example: "Terjemahkan paragraf ini ke bahasa Inggris",
    keywords: "terjemahkan, translate, bahasa Inggris",
    tool: "rewrite_paragraph",
    fn: "callMCPAPI(prompt, { mode: \"rewrite\" }) → typeText(hasil, paragrafBaru)",
    action: "Paragraf di kursor diterjemahkan, muncul sebagai versi baru di bawah paragraf asli.",
    target: "dokumen_bawah_paragraf",
  },
  {
    intent: "ringkas_dokumen",
    group: "pendukung",
    command: "Ringkas dokumen",
    example: "Ringkas seluruh dokumen",
    keywords: "ringkas, ringkasan, rangkum",
    tool: "summarize_document",
    fn: "handleInlineAIAction(\"summarize\")",
    action: "AI membuat ringkasan seluruh dokumen dan menuliskannya di posisi kursor.",
    target: "dokumen_kursor",
  },
  {
    intent: "undo",
    group: "pendukung",
    command: "Undo",
    example: "Undo",
    keywords: "undo, kembalikan, batalkan perubahan terakhir",
    tool: "undo",
    fn: "undo()",
    action: "Membatalkan perubahan terakhir di dokumen.",
    target: "dokumen_riwayat",
  },
  {
    intent: "redo",
    group: "pendukung",
    command: "Redo",
    example: "Redo",
    keywords: "redo, ulangi, kembalikan lagi",
    tool: "redo",
    fn: "redo()",
    action: "Mengulang perubahan yang tadi di-undo.",
    target: "dokumen_riwayat",
  },
  {
    intent: "ke_awal_akhir_dokumen",
    group: "pendukung",
    command: "Ke awal / akhir dokumen",
    example: "Ke akhir dokumen",
    keywords: "ke awal, ke akhir, paling atas, paling bawah",
    tool: "go_to",
    fn: "editor.setTextCursorPosition(blokPertama|blokTerakhir) → scrollBlockIntoView(id)",
    match: args => has(args.target, /^(awal|akhir|atas|bawah|paling atas|paling bawah)$/),
    action: "Kursor dipindah ke awal atau akhir dokumen.",
    target: "kursor",
  },
  {
    intent: "pindah_ke_bagian",
    group: "pendukung",
    command: "Pindah ke bagian",
    example: "Pindah ke bagian Pendahuluan",
    keywords: "pindah ke, ke bagian + nama judul",
    tool: "go_to",
    fn: "editor.setTextCursorPosition(blokJudul) → scrollBlockIntoView(id)",
    action: "Kursor dipindah ke judul yang disebut dan halaman menggulir ke sana.",
    target: "kursor",
  },
  {
    intent: "tambah_judul",
    group: "pendukung",
    command: "Tambah judul",
    example: "Tambah judul Tinjauan Pustaka",
    keywords: "tambah judul, buat judul, sub judul, judul utama",
    tool: "add_block",
    fn: "editor.insertBlocks([heading, paragraph], blokKursor, \"after\")",
    match: args => str(args.kind) === "heading",
    action:
      "Judul baru (level 2; 'judul utama' = level 1, 'sub judul' = level 3) ditambahkan di bawah kursor, kursor pindah ke baris setelahnya.",
    target: "dokumen_bawah_kursor",
  },
  {
    intent: "tambah_paragraf",
    group: "pendukung",
    command: "Tambah paragraf",
    example: "Tambah paragraf baru",
    keywords: "tambah paragraf, paragraf baru",
    tool: "add_block",
    fn: "editor.insertBlocks([paragraph], blokKursor, \"after\")",
    action: "Paragraf baru (kosong atau berisi teks yang disebut) ditambahkan di bawah kursor.",
    target: "dokumen_bawah_kursor",
  },
  {
    intent: "dikte_teks",
    group: "pendukung",
    command: "Tulis (dikte)",
    example: "Tulis: penelitian ini bertujuan untuk menganalisis kinerja model",
    keywords: "tulis:, ketik",
    tool: "insert_text",
    fn: "editor.insertInlineContent(text)",
    action: "Kata-kata setelah 'tulis' diketik apa adanya di posisi kursor (dikte, bukan buatan AI).",
    target: "dokumen_kursor",
  },
  {
    intent: "daftar_judul",
    group: "pendukung",
    command: "Daftar judul",
    example: "Apa saja judul di dokumen ini?",
    keywords: "daftar judul, struktur dokumen, jumlah kata",
    tool: "get_outline",
    fn: "headings() dari editor.document",
    action: "Notifikasi menampilkan daftar judul dokumen dan jumlah katanya.",
    target: "notifikasi",
  },
  {
    intent: "tanya_referensi",
    group: "pendukung",
    command: "Tanya referensi",
    example: "Apa metode yang dipakai di artikel referensi?",
    keywords: "tanya artikel, menurut referensi, apa ... di artikel",
    tool: "ask_references",
    fn: "callMCPAPI(question)",
    action: "AI menjawab dari artikel referensi project; jawaban tampil di notifikasi (tidak menulis ke dokumen).",
    target: "notifikasi",
  },

  // ---- Nonaktif: only so runs from before 2026-11-17 still get a description ----
  {
    intent: "kalimat_lanjutan",
    group: "nonaktif",
    command: "Kalimat lanjutan (jendela AI)",
    example: "-",
    keywords: "-",
    tool: "generate_with_ai",
    fn: "handleAIGenerationWithProgress(topic, \"sentence\")",
    action: "AI membuat beberapa kalimat lanjutan, tampil di jendela AI.",
    target: "jendela_ai",
  },
  {
    intent: "tulis_bebas",
    group: "nonaktif",
    command: "Tulis bebas",
    example: "Kembangkan paragraf ini",
    keywords: "-",
    tool: "write_freely",
    fn: "handleInlineAIAction(\"write_anything\")",
    action: "AI menulis bebas/kreatif melanjutkan konteks di posisi kursor.",
    target: "dokumen_kursor",
  },
  {
    intent: "baca_paragraf",
    group: "nonaktif",
    command: "Baca paragraf",
    example: "-",
    keywords: "-",
    tool: "read_current_paragraph",
    fn: "analyzeCurrentCursorContext()",
    action: "Membaca paragraf di posisi kursor.",
    target: "notifikasi",
  },
];

/** Sheet "Alur Pakai": how the four main commands are used, step by step. */
export interface CommandFlow {
  intent: string;
  /** "1. Ucapkan" */
  say: string;
  /** "2. Hasil" */
  result: string;
  /** "3. Lalu ucapkan" */
  thenSay: string;
  /** "4. Akhirnya" */
  outcome: string;
}

export const COMMAND_FLOWS: CommandFlow[] = [
  {
    intent: "buat_outline_artikel",
    say: "Buat outline artikel",
    result: "Outline tampil di jendela AI",
    thenSay: "Ya, masukkan outline-nya dan ganti seluruh dokumen",
    outcome: "Outline menggantikan isi dokumen",
  },
  {
    intent: "isi_konten_artikel",
    say: "Taruh kursor di judul bagian → Isi konten artikel",
    result: "Isi tampil di jendela AI",
    thenSay: "Masukkan hasilnya",
    outcome: "Isi masuk ke dokumen di bagian itu",
  },
  {
    intent: "lanjutkan_paragraf",
    say: "Taruh kursor di akhir paragraf → Lanjutkan paragraf",
    result: "Teks AI muncul di dokumen (ditandai)",
    thenSay: "Terima / Batalkan",
    outcome: "Teks disimpan atau dibuang",
  },
  {
    intent: "parafrasekan_paragraf",
    say: "Taruh kursor di paragraf → Parafrasekan paragraf",
    result: "Versi baru muncul di bawah paragraf asli",
    thenSay: "Terima / Batalkan",
    outcome: "Versi baru menggantikan paragraf asli, atau dibuang",
  },
];

/** Tip under the flows in "Alur Pakai". */
export const FLOW_TIP = 'Satu rekaman boleh berisi beberapa perintah berurutan, mis. "lanjutkan paragraf lalu terima".';

/** What the help pop-up shows (GET /api/voice/commands): active commands only, no tool/function. */
export interface HelpCommand {
  no: number;
  intent: string;
  group: "utama" | "pendukung";
  command: string;
  example: string;
  keywords: string;
  action: string;
  target: CommandTarget;
  targetLabel: string;
}

export interface CommandHelp {
  commands: HelpCommand[];
  flows: (CommandFlow & { command: string })[];
  targets: { id: CommandTarget; label: string }[];
  tip: string;
  /** "db" = read from Postgres; "catalog" = DB unavailable, built from this file. */
  source: "db" | "catalog";
}

/** The help content straight from this file (also the fallback when the DB is down). */
export function catalogHelp(): CommandHelp {
  const active = COMMAND_CATALOG.filter(row => row.group !== "nonaktif");
  const name = new Map(active.map(row => [row.intent, row.command]));
  return {
    commands: active.map((row, i) => ({
      no: i + 1,
      intent: row.intent,
      group: row.group as HelpCommand["group"],
      command: row.command,
      example: row.example,
      keywords: row.keywords,
      action: row.action,
      target: row.target,
      targetLabel: TARGET_LABEL[row.target],
    })),
    flows: COMMAND_FLOWS.map(flow => ({ ...flow, command: name.get(flow.intent) ?? flow.intent })),
    targets: (Object.keys(TARGET_LABEL) as CommandTarget[]).map(id => ({ id, label: TARGET_LABEL[id] })),
    tip: FLOW_TIP,
    source: "catalog",
  };
}

export interface DescribedCall {
  intent: string | null;
  command: string | null;
  /** Tool called by the interpreter. */
  tool: string;
  args: Record<string, unknown>;
  /** Editor function that ran it (inside runVoiceCommand). */
  function: string | null;
  /** The dispatcher every tool goes through. */
  executor: string;
  action: string;
  target: CommandTarget | null;
  targetLabel: string | null;
}

/** Intent, action and target of one tool call (unknown tools get intent null). */
export function describeCall(tool: string, args: Record<string, unknown> = {}): DescribedCall {
  const entry = COMMAND_CATALOG.find(row => row.tool === tool && (!row.match || row.match(args)));
  if (!entry) {
    return {
      intent: null,
      command: null,
      tool,
      args,
      function: null,
      executor: COMMAND_EXECUTOR,
      action: "Tool tidak ada di katalog perintah.",
      target: null,
      targetLabel: null,
    };
  }
  return {
    intent: entry.intent,
    command: entry.command,
    tool,
    args,
    function: entry.fn,
    executor: COMMAND_EXECUTOR,
    action: entry.action,
    target: entry.target,
    targetLabel: TARGET_LABEL[entry.target],
  };
}

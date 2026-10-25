/**
 * Function tools the realtime voice model can call. Each `name` is handled
 * by `runVoiceCommand` in PlateEditor — keep the two in sync.
 */
const ALL_VOICE_TOOLS = [
  {
    type: "function",
    name: "continue_writing",
    description: "Lanjutkan tulisan dari posisi kursor (mis. 'lanjutkan tulis', 'terusin', 'tambah lagi').",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function",
    name: "write_freely",
    description: "Tulis bebas/kreatif melanjutkan konteks di kursor (mis. 'tulis sesuatu', 'kembangkan ini').",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function",
    name: "summarize_document",
    description: "Buat ringkasan seluruh dokumen dan tulis di posisi kursor.",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function",
    name: "rewrite_paragraph",
    description:
      "Tulis ulang paragraf di posisi kursor: parafrase, perbaiki tata bahasa, buat lebih formal, persingkat, perpanjang, atau terjemahkan.",
    parameters: {
      type: "object",
      properties: {
        instruction: {
          type: "string",
          description: "Instruksi penulisan ulang, mis. 'parafrasekan', 'buat lebih formal', 'terjemahkan ke bahasa Inggris'.",
        },
      },
      required: ["instruction"],
    },
  },
  {
    type: "function",
    name: "accept_ai_text",
    description: "Terima/simpan teks AI yang baru ditulis (mis. 'terima', 'oke simpan', 'pakai itu').",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function",
    name: "reject_ai_text",
    description: "Batalkan/buang teks AI yang baru ditulis (mis. 'batalkan', 'buang', 'jangan pakai').",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function",
    name: "generate_with_ai",
    description:
      "Buat konten baru dengan AI di jendela AI (hasil ditampilkan dulu sebagai pratinjau), berdasarkan artikel referensi project. mode 'structure' = kerangka/outline (topic boleh kosong: outline disusun dari artikel yang tersedia), 'content' = isi untuk bagian/heading di posisi kursor sesuai outline, 'sentence' = beberapa kalimat lanjutan.",
    parameters: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["structure", "content", "sentence"] },
        topic: { type: "string", description: "Topik atau arahan user. Kosongkan untuk outline dari artikel referensi." },
      },
      required: ["mode"],
    },
  },
  {
    type: "function",
    name: "insert_generated_content",
    description:
      "Masukkan hasil pratinjau dari jendela AI ke dokumen (mis. 'masukkan hasilnya'). Untuk kerangka, ini mengganti seluruh isi dokumen sehingga butuh konfirmasi user.",
    parameters: {
      type: "object",
      properties: {
        confirmed: { type: "boolean", description: "true hanya jika user sudah setuju secara eksplisit mengganti seluruh dokumen." },
      },
    },
  },
  {
    type: "function",
    name: "close_ai_window",
    description: "Tutup jendela AI tanpa memasukkan hasil.",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function",
    name: "undo",
    description: "Batalkan perubahan terakhir di dokumen (undo).",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function",
    name: "redo",
    description: "Ulangi perubahan yang tadi dibatalkan (redo).",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function",
    name: "go_to",
    description: "Pindahkan kursor ke judul/bagian tertentu, atau ke 'awal' / 'akhir' dokumen.",
    parameters: {
      type: "object",
      properties: {
        target: { type: "string", description: "Teks judul yang dituju, atau 'awal' / 'akhir'." },
      },
      required: ["target"],
    },
  },
  {
    type: "function",
    name: "insert_text",
    description:
      "Dikte: masukkan kata-kata user apa adanya di posisi kursor (mis. 'tulis: penelitian ini bertujuan ...'). Jangan dipakai untuk konten buatan AI.",
    parameters: {
      type: "object",
      properties: { text: { type: "string", description: "Teks persis seperti didiktekan user, dengan tanda baca yang wajar." } },
      required: ["text"],
    },
  },
  {
    type: "function",
    name: "add_block",
    description: "Tambah judul baru atau paragraf baru di bawah posisi kursor.",
    parameters: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["heading", "paragraph"] },
        text: { type: "string", description: "Isi judul/paragraf (boleh kosong untuk paragraf)." },
        level: { type: "integer", enum: [1, 2, 3], description: "Level judul, default 2." },
      },
      required: ["kind"],
    },
  },
  {
    type: "function",
    name: "get_outline",
    description: "Baca daftar judul dokumen dan jumlah kata.",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function",
    name: "read_current_paragraph",
    description: "Baca paragraf di posisi kursor (untuk dibacakan atau dikomentari).",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function",
    name: "ask_references",
    description:
      "Jawab pertanyaan berdasarkan artikel/referensi di project ini (mis. 'apa metode di artikel X?'). Tidak menulis ke dokumen.",
    parameters: {
      type: "object",
      properties: { question: { type: "string" } },
      required: ["question"],
    },
  },
] as const;

/**
 * The commands switched on for now — kept to the essentials so the voice
 * model rarely picks the wrong one. Add a name here to enable more; every
 * tool above is already handled by runVoiceCommand.
 */
const ENABLED_TOOLS: string[] = [
  "generate_with_ai", // 1. buat outline dari artikel / 2. isi konten bagian ini
  "insert_generated_content", //    (+ "masukkan hasilnya")
  "continue_writing", // 3. lanjutkan menulis
  "rewrite_paragraph", // 4. parafrase / perbaiki paragraf
  "accept_ai_text", // 5. terima / batalkan
  "reject_ai_text",
];

export const VOICE_TOOLS = ALL_VOICE_TOOLS.filter(tool => ENABLED_TOOLS.includes(tool.name));

export const VOICE_INSTRUCTIONS = `Kamu adalah asisten suara untuk editor penulisan ilmiah "SRE Writer".
Bicara dalam bahasa Indonesia yang santai, sopan, dan SINGKAT (1-2 kalimat), karena user sedang menulis.

Aturan:
- Untuk setiap perintah yang mengubah dokumen, PANGGIL TOOL yang sesuai. Jangan pernah mengarang isi tulisan sendiri lewat suara.
- Sebelum tool yang butuh waktu (continue_writing, write_freely, summarize_document, rewrite_paragraph, generate_with_ai, ask_references), ucapkan konfirmasi singkat seperti "Oke, saya lanjutkan ya."
- Setelah tool selesai, sampaikan hasilnya singkat berdasarkan "message" dari tool. Jangan membacakan seluruh teks yang ditulis kecuali diminta.
- Jika tool gagal (ok=false), jelaskan alasannya singkat dan sarankan langkah berikutnya.
- insert_generated_content untuk kerangka (structure) MENGGANTI seluruh dokumen: tanyakan konfirmasi dulu, dan hanya kirim confirmed=true setelah user jelas setuju.
- Jika perintah ambigu, tanyakan balik dengan singkat.
- Saat ini hanya tersedia 5 perintah: buat outline dari artikel, isi konten bagian ini, lanjutkan menulis, parafrase/perbaiki paragraf, dan terima/batalkan teks AI. Jika user meminta hal lain, katakan dengan sopan bahwa perintah itu belum tersedia lalu sebutkan perintah yang tersedia.`;

/**
 * Reliability test for the writer's AI against the real mcp-sre (the tools
 * /api/copilot and /api/chat call, minus login). Every call is one test that
 * records its latency; each feature then checks its success rate and p95
 * against a target. Latencies vary from run to run (OpenAI load, network),
 * so a feature near its target can pass one run and fail the next.
 *
 * Also checks that what would land in the editor has no repetition: ghost
 * text that repeats the last typed word, or a section heading written again.
 *
 * `npm run test:ai` — needs mcp-sre running (PY_URL, default
 * http://localhost:9200); runs on the lecturer's key, so counts stay small.
 * Every call is also appended to logs/ai-reliability-test.jsonl for
 * scripts/ai-latency-report.mjs.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { dropRepeatedLines } from "@/lib/aiText";

const PY_URL = process.env.PY_URL ?? "http://localhost:9200";
const JSONL = path.join(process.cwd(), "logs", "ai-reliability-test.jsonl");

// "Draft: Pengembangan web" (has one article with references).
const PROJECT = {
  sessionId: "5d799216-48d6-415a-8650-3bcf778144c0",
  nodeIds: ["8f040188-8345-4dd0-a4bf-e56ab01094d1"],
  articleIds: ["f4b9e5a7-7af0-488d-b101-cb0ef8a263b1"],
};

/** p95 targets (ms), as in scripts/ai-latency-report.mjs. */
const TARGET_P95 = { copilot: 1500, writer: 15000 };
const MIN_SUCCESS = 0.99;

const mcpUp = await fetch(PY_URL, { signal: AbortSignal.timeout(3000) }).then(
  () => true,
  () => false,
);

type Call = { feature: string; ms: number; ok: boolean; output: string; timings?: Record<string, number> };
const calls: Call[] = [];

async function callTool(feature: string, name: string, args: object, timeoutMs: number): Promise<Call & { content?: any }> {
  const start = performance.now();
  let content: any;
  let error: string | undefined;
  try {
    const res = await fetch(`${PY_URL}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "tools/call", params: { name, arguments: args }, id: 1 }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await res.json();
    if (!res.ok || data.error) error = data.error?.message ?? `HTTP ${res.status}`;
    else content = JSON.parse(data.result?.content?.[0]?.text || "{}");
  } catch (e) {
    error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }
  const ms = Math.round(performance.now() - start);
  const output = String(content?.completion ?? content?.response ?? "");
  const call = { feature, ms, ok: !error, output, timings: content?.timings };
  calls.push(call);

  mkdirSync(path.dirname(JSONL), { recursive: true });
  appendFileSync(
    JSONL,
    JSON.stringify({
      ts: new Date().toISOString(),
      route: "test",
      feature,
      status: error ? (/Timeout|Abort/.test(error) ? "timeout" : "error") : output.trim() ? "ok" : "empty",
      totalMs: ms,
      mcpMs: ms,
      outputChars: output.length,
      outputTokens: content?.usage_metadata?.output_tokens,
      timings: content?.timings,
      error,
    }) + "\n",
  );
  return { ...call, content };
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim();
const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};

/** Final check of a feature: success rate and p95 latency over its calls. */
function expectFeatureHealthy(feature: string, targetMs: number, annotate: (msg: string) => unknown) {
  const own = calls.filter((c) => c.feature === feature);
  const ok = own.filter((c) => c.ok);
  const p50 = percentile(ok.map((c) => c.ms), 50);
  const p95 = percentile(ok.map((c) => c.ms), 95);
  annotate(`${ok.length}/${own.length} berhasil, p50=${p50} ms, p95=${p95} ms (target ${targetMs} ms)`);
  expect(ok.length / own.length, "tingkat keberhasilan").toBeGreaterThanOrEqual(MIN_SUCCESS);
  expect(p95, "p95 latensi (ms)").toBeLessThanOrEqual(targetMs);
}

const AUTOCOMPLETE_TEXTS = [
  "Pengembangan web modern menuntut performa yang tinggi dimana ",
  "Penelitian ini bertujuan untuk menganalisis ",
  "Metode yang digunakan dalam penelitian ini adalah ",
  "Hasil pengujian menunjukkan bahwa waktu respons ",
  "Framework JavaScript seperti React dan Vue ",
  "Salah satu tantangan utama dalam pengembangan aplikasi web adalah ",
  "Berdasarkan hasil analisis data yang dimana ",
  "Oleh karena itu, ",
  "Arsitektur microservices memungkinkan ",
  "Pengujian dilakukan dengan menggunakan ",
];

const SHORT_DOC = "Pengembangan web modern berkembang pesat dalam satu dekade terakhir.";
const LONG_DOC = Array.from({ length: 12 }, (_, i) =>
  `Paragraf ${i + 1}: pengembangan aplikasi web melibatkan perancangan antarmuka, pengelolaan data, keamanan, dan performa. ` +
  "Setiap tahap memerlukan evaluasi yang cermat agar aplikasi dapat digunakan dengan nyaman oleh pengguna dan mudah dipelihara.",
).join("\n");
const OUTLINE_HEADINGS = ["Pengembangan Web Modern", "Pendahuluan", "Metode Penelitian", "Hasil dan Pembahasan", "Kesimpulan"];
const OUTLINE = OUTLINE_HEADINGS.map((h, i) => `${i === 0 ? "#" : "##"} ${h}`).join("\n");

function generateArgs(mode: string, task: string, retrievalQuery: string) {
  return {
    task,
    retrieval_query: retrievalQuery,
    session_id: PROJECT.sessionId,
    mode,
    context_node_ids: PROJECT.nodeIds,
    context_article_ids: PROJECT.articleIds,
  };
}

describe.skipIf(!mcpUp)("Keandalan AI writer (mcp-sre sungguhan)", () => {
  describe("Autocomplete (ghost text)", () => {
    const sequential = Array.from({ length: 30 }, (_, i) => AUTOCOMPLETE_TEXTS[i % AUTOCOMPLETE_TEXTS.length]);

    test.for(sequential.map((text, i) => [i + 1, text] as const))("saran #%i: \"%s\"", async ([, text], { annotate }) => {
      const call = await callTool("copilot", "writer_autocomplete", { text_before: text }, 15_000);
      await annotate(`${call.ms} ms: "${call.output.trim().slice(0, 60)}"`);
      expect(call.ok, "panggilan berhasil").toBe(true);
      expect(call.output.trim(), "ada saran").not.toBe("");

      const lastWord = norm(text.trim().split(/\s+/).at(-1) ?? "");
      const firstWord = norm(call.output.trim().split(/\s+/)[0] ?? "");
      expect(firstWord, `saran tidak boleh mengulang kata "${lastWord}"`).not.toBe(lastWord);
    });

    test.for([1, 2, 3, 4, 5])("3 pengguna bersamaan, putaran %i", async (round, { annotate }) => {
      const texts = [0, 1, 2].map((u) => AUTOCOMPLETE_TEXTS[(round * 3 + u) % AUTOCOMPLETE_TEXTS.length]);
      const results = await Promise.all(texts.map((t) => callTool("copilot", "writer_autocomplete", { text_before: t }, 15_000)));
      await annotate(results.map((r) => `${r.ms} ms`).join(", "));
      expect(results.every((r) => r.ok), "semua panggilan berhasil").toBe(true);
    });

    test(`p95 di bawah ${TARGET_P95.copilot} ms dan berhasil >= 99%`, ({ annotate }) => {
      expectFeatureHealthy("copilot", TARGET_P95.copilot, annotate);
    });
  });

  describe("Lanjutkan menulis", () => {
    const docs: [string, string][] = [
      ["pendek", SHORT_DOC],
      ["pendek", SHORT_DOC],
      ["pendek", SHORT_DOC],
      ["panjang", LONG_DOC],
      ["panjang", LONG_DOC],
      ["panjang", LONG_DOC],
    ];
    test.for(docs)("dokumen %s", async ([, doc], { annotate }) => {
      const call = await callTool(
        "writer_continue",
        "writer_generate",
        generateArgs("continue", `Lanjutkan tulisan berikut dengan 1-2 paragraf:\n\n${doc}`, doc.slice(-300)),
        120_000,
      );
      await annotate(`${call.ms} ms (retrieval ${call.timings?.retrieval_ms} ms, llm ${call.timings?.llm_ms} ms)`);
      expect(call.ok, "panggilan berhasil").toBe(true);
      expect(call.output.trim(), "ada tulisan").not.toBe("");
    });

    test(`p95 di bawah ${TARGET_P95.writer} ms dan berhasil >= 99%`, ({ annotate }) => {
      expectFeatureHealthy("writer_continue", TARGET_P95.writer, annotate);
    });
  });

  describe("Isi konten bagian", () => {
    test.for(["Pendahuluan", "Metode Penelitian", "Hasil dan Pembahasan", "Kesimpulan"])(
      "bagian \"%s\"",
      async (heading, { annotate }) => {
        const call = await callTool(
          "writer_content",
          "writer_generate",
          generateArgs(
            "content",
            `Tulis isi untuk bagian "${heading}" dari artikel ini.\n\nOUTLINE DOKUMEN:\n${OUTLINE}\n\nBAGIAN YANG DITULIS: ${heading}\nISI BAGIAN INI SAAT INI:\n(kosong)\n\nINSTRUKSI:\n-- Tulis 2-4 paragraf\n-- JANGAN tulis ulang heading atau struktur; HANYA paragraf`,
            heading,
          ),
          120_000,
        );
        await annotate(`${call.ms} ms (retrieval ${call.timings?.retrieval_ms} ms, llm ${call.timings?.llm_ms} ms)`);
        expect(call.ok, "panggilan berhasil").toBe(true);

        // What the editor would insert (same filter as PlateEditor).
        const lines = call.output.split("\n").filter((l) => l.trim());
        const inserted = dropRepeatedLines(lines, OUTLINE_HEADINGS);
        expect(inserted.length, "ada isi yang dimasukkan").toBeGreaterThan(0);
        expect(inserted.map(norm), `heading "${heading}" tidak boleh masuk lagi`).not.toContain(norm(heading));
        expect(new Set(inserted.map(norm)).size, "tidak ada baris dobel").toBe(inserted.length);
      },
    );

    test(`p95 di bawah ${TARGET_P95.writer} ms dan berhasil >= 99%`, ({ annotate }) => {
      expectFeatureHealthy("writer_content", TARGET_P95.writer, annotate);
    });
  });

  describe("Outline (struktur)", () => {
    test.for([1, 2, 3])("outline #%i", async (_, { annotate }) => {
      const call = await callTool(
        "writer_structure",
        "writer_generate",
        generateArgs("structure", "Buat outline artikel ilmiah dari artikel referensi project. HANYA heading # ## ###.", "topik utama, metode, temuan, dan celah penelitian"),
        120_000,
      );
      await annotate(`${call.ms} ms (retrieval ${call.timings?.retrieval_ms} ms, llm ${call.timings?.llm_ms} ms)`);
      expect(call.ok, "panggilan berhasil").toBe(true);
      expect(call.output, "berisi heading markdown").toMatch(/^#{1,3}\s/m);
    });

    test(`p95 di bawah ${TARGET_P95.writer} ms dan berhasil >= 99%`, ({ annotate }) => {
      expectFeatureHealthy("writer_structure", TARGET_P95.writer, annotate);
    });
  });

  describe("Parafrase", () => {
    test.for([0, 1, 2])("paragraf #%i", async (i, { annotate }) => {
      const paragraph = LONG_DOC.split("\n")[i];
      const call = await callTool(
        "writer_rewrite",
        "writer_generate",
        generateArgs("rewrite", `Parafrasekan paragraf berikut:\n\n${paragraph}`, paragraph.slice(0, 300)),
        120_000,
      );
      await annotate(`${call.ms} ms`);
      expect(call.ok, "panggilan berhasil").toBe(true);
      expect(norm(call.output), "hasil berbeda dari aslinya").not.toBe(norm(paragraph));
    });

    test(`p95 di bawah ${TARGET_P95.writer} ms dan berhasil >= 99%`, ({ annotate }) => {
      expectFeatureHealthy("writer_rewrite", TARGET_P95.writer, annotate);
    });
  });
});

test.runIf(!mcpUp)("mcp-sre tidak menyala: tes AI dilewati", ({ annotate }) => {
  annotate(`Tidak bisa menghubungi ${PY_URL}. Jalankan: cd C:\\laragon\\www\\mcp-sre && python mcp_server.py --transport http`);
});

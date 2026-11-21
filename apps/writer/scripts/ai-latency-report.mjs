// Summarises logs/ai-latency.jsonl (written by src/lib/aiLatencyLog.ts, or
// logs/ai-reliability-test.jsonl from `npm run test:ai` via --file) per
// AI feature: request count, success rate and latency percentiles, checked
// against the target for that feature.
//
//   node scripts/ai-latency-report.mjs                 (all records)
//   node scripts/ai-latency-report.mjs --since 2026-10-28T10:00
//   node scripts/ai-latency-report.mjs --file other.jsonl
import { readFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const file = arg("--file") ?? path.join(process.cwd(), "logs", "ai-latency.jsonl");
const since = arg("--since") ? new Date(arg("--since")) : null;

// p95 targets (ms) for the whole route. Ghost text that arrives after ~2 s
// is usually useless (the writer kept typing); a writing action is a button
// press the writer waits for.
const TARGET_P95 = { copilot: 1500, pral_chat: 15000 };
const targetFor = (feature) => TARGET_P95[feature] ?? (feature.startsWith("writer_") ? 15000 : undefined);

let lines;
try {
  lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
} catch {
  console.error(`No log file at ${file}. Use the AI features first (writer dev server must be running).`);
  process.exit(1);
}

const records = lines
  .map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  })
  .filter((r) => r && (!since || new Date(r.ts) >= since));

const percentile = (sorted, p) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : undefined;
const avg = (values) => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : undefined);

const byFeature = new Map();
for (const r of records) {
  if (!byFeature.has(r.feature)) byFeature.set(r.feature, []);
  byFeature.get(r.feature).push(r);
}

const rows = [];
for (const [feature, list] of byFeature) {
  // Rate-limited requests never reach the AI, so they don't count for latency.
  const served = list.filter((r) => r.status !== "rate_limited");
  const ok = served.filter((r) => r.status === "ok" || r.status === "empty");
  const totals = ok.map((r) => r.totalMs).sort((a, b) => a - b);
  const p95 = percentile(totals, 95);
  const target = targetFor(feature);

  rows.push({
    feature,
    n: list.length,
    "success%": served.length ? +((ok.length / served.length) * 100).toFixed(1) : "-",
    empty: list.filter((r) => r.status === "empty").length,
    timeout: list.filter((r) => r.status === "timeout").length,
    error: list.filter((r) => r.status === "error").length,
    limited: list.filter((r) => r.status === "rate_limited").length,
    p50: percentile(totals, 50),
    p90: percentile(totals, 90),
    p95,
    p99: percentile(totals, 99),
    max: totals.at(-1),
    "avg llm": avg(ok.map((r) => r.timings?.llm_ms).filter(Number.isFinite)),
    "avg retrieval": avg(ok.map((r) => r.timings?.retrieval_ms).filter(Number.isFinite)),
    "avg overhead": avg(ok.filter((r) => Number.isFinite(r.mcpMs)).map((r) => r.totalMs - r.mcpMs)),
    "avg out tok": avg(ok.map((r) => r.outputTokens).filter(Number.isFinite)),
    "target p95": target ?? "-",
    pass: target && p95 !== undefined ? (p95 <= target ? "YES" : "NO") : "-",
  });
}

console.log(`${records.length} records from ${file}${since ? ` since ${since.toISOString()}` : ""}`);
console.log("All times in ms. Percentiles use successful requests only.");
console.table(rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v ?? "-"]))));

const failures = records.filter((r) => r.status === "error" || r.status === "timeout").slice(-10);
if (failures.length) {
  console.log("\nLast failures:");
  for (const r of failures) console.log(`  ${r.ts} ${r.feature} ${r.status} ${r.totalMs}ms ${r.error ?? ""}`);
}

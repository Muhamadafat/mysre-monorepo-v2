import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * Latency log for the AI routes (copilot, chat/writer), used for reliability
 * testing. Every request prints one `[ai-latency]` line to the server console
 * and appends the same record as JSON to logs/ai-latency.jsonl (relative to
 * the writer app), which scripts/ai-latency-report.mjs summarises.
 *
 * On by default in dev (AI_LATENCY_LOG=off turns it off); OFF in production
 * unless the deploy sets AI_LATENCY_LOG=on.
 */
export type AiLatencyRecord = {
  route: "copilot" | "chat";
  /** copilot, writer_<mode> or pral_chat */
  feature: string;
  userId?: string;
  status: "ok" | "empty" | "rate_limited" | "timeout" | "error";
  /** Whole route, from request in to response out. */
  totalMs: number;
  /** Only the round trip to mcp-sre (retrieval + LLM). */
  mcpMs?: number;
  promptChars?: number;
  outputChars?: number;
  inputTokens?: number;
  outputTokens?: number;
  /** Phase timings reported by mcp-sre itself. */
  timings?: Record<string, number>;
  error?: string;
};

const LOG_FILE = path.join(process.cwd(), "logs", "ai-latency.jsonl");

export function logAiLatency(record: AiLatencyRecord) {
  const setting = process.env.AI_LATENCY_LOG;
  if (setting === "off" || (process.env.NODE_ENV === "production" && setting !== "on")) return;

  const entry = { ts: new Date().toISOString(), ...record };
  console.log(
    `[ai-latency] ${entry.feature} ${entry.status} total=${entry.totalMs}ms` +
      (entry.mcpMs !== undefined ? ` mcp=${entry.mcpMs}ms` : "") +
      (entry.timings ? ` ${JSON.stringify(entry.timings)}` : "") +
      (entry.error ? ` error=${entry.error}` : ""),
  );

  // Fire and forget: a failing log write must never slow down or break the
  // request it measures.
  mkdir(path.dirname(LOG_FILE), { recursive: true })
    .then(() => appendFile(LOG_FILE, JSON.stringify(entry) + "\n"))
    .catch((error) => console.error("[ai-latency] write failed:", error));
}

/** Milliseconds since `start` (a performance.now() value), rounded. */
export const since = (start: number) => Math.round(performance.now() - start);

export const isTimeout = (error: unknown) =>
  error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");

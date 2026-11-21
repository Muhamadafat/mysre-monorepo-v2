import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@sre-monorepo/lib/server";
import { isTimeout, logAiLatency, since } from "@/lib/aiLatencyLog";
import { createCopilotLimiter } from "@/lib/copilotLimit";

/**
 * Ghost-text autocomplete for the draft editor (components/plate/copilot.tsx).
 * Receives the text before the cursor as `prompt` and answers `{ text }` with
 * the suggested continuation, which is the shape @platejs/ai's
 * CopilotPlugin expects.
 *
 * The completion itself runs in mcp-sre (writer_autocomplete) on the
 * lecturer's key, so every user gets a per-minute and per-day cap
 * (lib/copilotLimit.ts).
 */
const num = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const LIMITS = {
  perMinute: num(process.env.COPILOT_REQUESTS_PER_MINUTE, 20),
  perDay: num(process.env.COPILOT_REQUESTS_PER_DAY, 500),
};

const MAX_PROMPT_CHARS = 2000;

const allowRequest = createCopilotLimiter(LIMITS);

export async function POST(request: NextRequest) {
  const start = performance.now();
  const authSession = await getServerSession();
  const user = authSession?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { prompt } = await request.json().catch(() => ({}));
  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const userId = String(user.id);
  if (!allowRequest(userId)) {
    logAiLatency({ route: "copilot", feature: "copilot", userId, status: "rate_limited", totalMs: since(start) });
    return NextResponse.json({ error: "Batas saran otomatis tercapai. Coba lagi nanti." }, { status: 429 });
  }

  let mcpMs: number | undefined;
  try {
    const mcpStart = performance.now();
    const mcpResponse = await fetch(`${process.env.PY_URL}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "writer_autocomplete",
          arguments: { text_before: prompt.slice(-MAX_PROMPT_CHARS) },
        },
        id: 1,
      }),
      // The editor drops a suggestion that arrives after the writer moved on,
      // so a slow one is useless anyway.
      signal: AbortSignal.timeout(15_000),
    });
    if (!mcpResponse.ok) {
      throw new Error(`MCP request failed: ${mcpResponse.status} ${mcpResponse.statusText}`);
    }

    const mcpData = await mcpResponse.json();
    mcpMs = since(mcpStart);
    if (mcpData.error) {
      throw new Error(`MCP error: ${mcpData.error.message || "Unknown error"}`);
    }
    const content = JSON.parse(mcpData.result?.content?.[0]?.text || "{}");
    const text = typeof content.completion === "string" ? content.completion : "";

    logAiLatency({
      route: "copilot",
      feature: "copilot",
      userId,
      status: text.trim() ? "ok" : "empty",
      totalMs: since(start),
      mcpMs,
      promptChars: Math.min(prompt.length, MAX_PROMPT_CHARS),
      outputChars: text.length,
      inputTokens: content.usage_metadata?.input_tokens,
      outputTokens: content.usage_metadata?.output_tokens,
      timings: content.timings,
    });

    // CopilotPlugin treats an empty `text` as an error; a single space
    // means "no suggestion" without logging one (the editor ignores
    // whitespace-only completions).
    return NextResponse.json({ text: text || " " });
  } catch (error) {
    console.error("API Copilot Route Error:", error);
    logAiLatency({
      route: "copilot",
      feature: "copilot",
      userId,
      status: isTimeout(error) ? "timeout" : "error",
      totalMs: since(start),
      mcpMs,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Saran otomatis tidak tersedia." }, { status: 502 });
  }
}

import { COMMAND_INTERPRET_INSTRUCTIONS, VOICE_TOOLS } from "./tools";

/**
 * Turns one saved voice command (text) into editor tool calls, using the same
 * tools the live assistant had (only the enabled ones, see tools.ts), via
 * OpenAI chat completions. No database here, so it can be tested with a fake
 * fetch.
 *
 *   OPENAI_COMMAND_MODEL   default "gpt-4.1-mini"
 */
export const commandModel = () => process.env.OPENAI_COMMAND_MODEL || "gpt-4.1-mini";

export interface InterpretedCall {
  name: string;
  args: Record<string, unknown>;
}

export interface InterpretResult {
  calls: InterpretedCall[];
  /** The model's reply when it found no command to run. */
  reply: string | null;
  inputTokens: number;
  outputTokens: number;
}

export class InterpretError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "InterpretError";
  }
}

const ENABLED = new Set<string>(VOICE_TOOLS.map(tool => tool.name));

export async function interpretCommand(options: {
  text: string;
  apiKey: string;
  model?: string;
  safetyIdentifier?: string;
  fetchImpl?: typeof fetch;
}): Promise<InterpretResult> {
  const text = options.text.trim();
  if (!text) throw new InterpretError("Perintahnya kosong.", 400);
  const doFetch = options.fetchImpl ?? fetch;

  let res: Response;
  try {
    res = await doFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: options.model ?? commandModel(),
        temperature: 0,
        messages: [
          { role: "system", content: COMMAND_INTERPRET_INSTRUCTIONS },
          { role: "user", content: text },
        ],
        tools: VOICE_TOOLS.map(({ name, description, parameters }) => ({
          type: "function",
          function: { name, description, parameters },
        })),
        tool_choice: "auto",
        ...(options.safetyIdentifier && { safety_identifier: options.safetyIdentifier }),
      }),
    });
  } catch {
    throw new InterpretError("Tidak bisa menghubungi OpenAI.", 502);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new InterpretError(
      res.status === 429 ? "OpenAI sedang membatasi permintaan, coba lagi sebentar." : `OpenAI menolak permintaan (${res.status}). ${detail.slice(0, 200)}`,
      502
    );
  }

  const data = await res.json();
  const message = data?.choices?.[0]?.message ?? {};
  const calls: InterpretedCall[] = [];
  for (const call of message.tool_calls ?? []) {
    const name = call?.function?.name;
    if (!ENABLED.has(name)) continue; // only commands that are switched on
    let args: Record<string, unknown> = {};
    try {
      args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
    } catch {
      // Malformed arguments: the command reports what's missing.
    }
    calls.push({ name, args });
  }
  return {
    calls,
    reply: calls.length ? null : String(message.content ?? "").trim() || "Perintah tidak dikenali.",
    inputTokens: data?.usage?.prompt_tokens ?? 0,
    outputTokens: data?.usage?.completion_tokens ?? 0,
  };
}

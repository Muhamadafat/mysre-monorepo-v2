import { describe, expect, it } from "vitest";
import { InterpretError, interpretCommand } from "./interpretCommand";

const reply = (message: Record<string, unknown>, status = 200) =>
  (async () =>
    new Response(JSON.stringify({ choices: [{ message }], usage: { prompt_tokens: 120, completion_tokens: 15 } }), {
      status,
    })) as unknown as typeof fetch;

const call = (name: string, args: Record<string, unknown> = {}) => ({
  type: "function",
  function: { name, arguments: JSON.stringify(args) },
});

describe("interpretCommand", () => {
  it("returns the enabled tool calls with parsed args", async () => {
    const result = await interpretCommand({
      text: "parafrasekan paragraf ini lalu terima",
      apiKey: "k",
      fetchImpl: reply({ tool_calls: [call("rewrite_paragraph", { instruction: "parafrasekan" }), call("accept_ai_text")] }),
    });
    expect(result.calls).toEqual([
      { name: "rewrite_paragraph", args: { instruction: "parafrasekan" } },
      { name: "accept_ai_text", args: {} },
    ]);
    expect(result.reply).toBeNull();
    expect(result.inputTokens).toBe(120);
  });

  it("drops tools that are not enabled", async () => {
    const result = await interpretCommand({
      text: "bacakan paragraf ini",
      apiKey: "k",
      fetchImpl: reply({ tool_calls: [call("read_current_paragraph")], content: null }),
    });
    expect(result.calls).toEqual([]);
    expect(result.reply).toBe("Perintah tidak dikenali.");
  });

  it("passes the model's reply through when nothing matches", async () => {
    const result = await interpretCommand({
      text: "halo apa kabar",
      apiKey: "k",
      fetchImpl: reply({ content: "Itu bukan perintah yang tersedia." }),
    });
    expect(result).toMatchObject({ calls: [], reply: "Itu bukan perintah yang tersedia." });
  });

  it("sends only enabled tools in chat-completions format", async () => {
    let sent: any;
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: "x" } }] }));
    }) as unknown as typeof fetch;
    await interpretCommand({ text: "lanjutkan menulis", apiKey: "k", fetchImpl });
    const names = sent.tools.map((tool: any) => tool.function.name);
    expect(names).toContain("continue_writing");
    expect(names).toContain("undo");
    expect(names).not.toContain("read_current_paragraph");
    expect(sent.tools[0].type).toBe("function");
  });

  it("rejects empty text and API errors", async () => {
    await expect(interpretCommand({ text: "  ", apiKey: "k", fetchImpl: reply({}) })).rejects.toBeInstanceOf(InterpretError);
    await expect(interpretCommand({ text: "lanjut", apiKey: "k", fetchImpl: reply({}, 500) })).rejects.toMatchObject({ status: 502 });
  });
});

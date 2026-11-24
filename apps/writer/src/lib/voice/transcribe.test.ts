import { describe, expect, it, vi } from "vitest";
import { TranscribeError, estimateTranscribeUsd, speechToText, sttNeedsOpenAiKey, sttProvider, transcribeAudio } from "./transcribe";

const audio = new Uint8Array([1, 2, 3, 4]);

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("transcribeAudio", () => {
  it("sends the file, model and Indonesian language, and returns the text and usage", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { text: "  Lanjutkan tulisannya.  ", usage: { input_tokens: 120, output_tokens: 8 } })
    );
    const result = await transcribeAudio({ audio, mimeType: "audio/mpeg", apiKey: "sk-test", model: "gpt-4o-transcribe", fetchImpl });

    expect(result).toEqual({ text: "Lanjutkan tulisannya.", model: "gpt-4o-transcribe", inputTokens: 120, outputTokens: 8 });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const form = init.body as FormData;
    expect(form.get("model")).toBe("gpt-4o-transcribe");
    expect(form.get("language")).toBe("id");
    expect(form.get("response_format")).toBe("json");
    expect((form.get("file") as File).name).toBe("rekaman.mp3");
  });

  it("names WebM recordings .webm (OpenAI detects the format from the name)", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { text: "ok" }));
    await transcribeAudio({ audio, mimeType: "audio/webm;codecs=opus", apiKey: "k", fetchImpl });
    const form = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData;
    expect((form.get("file") as File).name).toBe("rekaman.webm");
  });

  it.each([
    [401, "API key"],
    [404, "akses ke model"],
    [413, "terlalu besar"],
    [429, "Kuota"],
    [500, "HTTP 500"],
  ])("turns OpenAI HTTP %i into a clear message", async (status, text) => {
    const fetchImpl = vi.fn(async () => jsonResponse(status, { error: { message: "x" } }));
    const error = await transcribeAudio({ audio, mimeType: "audio/mpeg", apiKey: "k", fetchImpl }).catch(e => e);
    expect(error).toBeInstanceOf(TranscribeError);
    expect(error.message).toContain(text);
  });

  it("refuses empty and oversized files without calling OpenAI", async () => {
    const fetchImpl = vi.fn();
    await expect(transcribeAudio({ audio: new Uint8Array(0), mimeType: "audio/mpeg", apiKey: "k", fetchImpl })).rejects.toThrow("kosong");
    await expect(
      transcribeAudio({ audio: new Uint8Array(26 * 1024 * 1024), mimeType: "audio/mpeg", apiKey: "k", fetchImpl })
    ).rejects.toThrow("25 MB");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports a network failure as unreachable", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(transcribeAudio({ audio, mimeType: "audio/mpeg", apiKey: "k", fetchImpl })).rejects.toThrow("menghubungi OpenAI");
  });
});

describe("estimateTranscribeUsd", () => {
  it("charges per minute of audio", () => {
    expect(estimateTranscribeUsd(60)).toBeCloseTo(0.006);
    expect(estimateTranscribeUsd(0)).toBeGreaterThan(0); // never free
  });
});

describe("speechToText (STT_PROVIDER)", () => {
  it("uses OpenAI by default", async () => {
    vi.stubEnv("STT_PROVIDER", "");
    const fetchImpl = vi.fn(async () => jsonResponse(200, { text: "Halo" }));
    const result = await speechToText({ audio, mimeType: "audio/mpeg", apiKey: "sk-test", model: "gpt-4o-transcribe", fetchImpl });
    expect(result.text).toBe("Halo");
    expect(sttNeedsOpenAiKey()).toBe(true);
    vi.unstubAllEnvs();
  });

  it("refuses a provider that isn't installed yet, without calling anyone", async () => {
    vi.stubEnv("STT_PROVIDER", "VendorLain");
    const fetchImpl = vi.fn();
    await expect(speechToText({ audio, mimeType: "audio/mpeg", apiKey: "", fetchImpl })).rejects.toMatchObject({ status: 501 });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(sttProvider()).toBe("vendorlain");
    expect(sttNeedsOpenAiKey()).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("isPromptEcho", () => {
  const prompt = "Percakapan bahasa Indonesia tentang penulisan karya ilmiah: draf, paragraf, outline, referensi, artikel.";
  it("flags the prompt's word list returned for a recording with no speech", async () => {
    const { isPromptEcho } = await import("./transcribe");
    expect(isPromptEcho("draf, paragraf, outline, referensi, artikel.", prompt)).toBe(true);
    expect(isPromptEcho("Draf paragraf", prompt)).toBe(true);
  });
  it("keeps real speech, even when it uses some of the same words", async () => {
    const { isPromptEcho } = await import("./transcribe");
    expect(isPromptEcho("buat outline artikel tentang energi surya", prompt)).toBe(false);
    expect(isPromptEcho("", prompt)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { crc32, zipStream } from "./zip";

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

describe("admin zip", () => {
  it("crc32 matches the known value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("writes local headers, a central directory and skips null entries", async () => {
    const enc = new TextEncoder();
    const zip = await collect(
      zipStream([
        { name: "a.txt", load: async () => enc.encode("halo") },
        { name: "skip.txt", load: async () => null },
        { name: "folder/b.txt", load: async () => enc.encode("dunia!") },
      ])
    );
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const end = zip.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2); // two files
    const text = new TextDecoder().decode(zip);
    expect(text).toContain("halo");
    expect(text).toContain("folder/b.txt");
    expect(text).not.toContain("skip.txt");
  });
});

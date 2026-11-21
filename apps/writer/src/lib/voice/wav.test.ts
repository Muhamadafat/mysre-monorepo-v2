import { describe, expect, it } from "vitest";
import { wavToMp3 } from "./mp3";
import { createDownsampler, encodeWav, parseWav, WAV_SAMPLE_RATE } from "./wav";

const tone = (rate: number, seconds: number, hz = 440) =>
  Float32Array.from({ length: Math.round(rate * seconds) }, (_, i) => 0.5 * Math.sin((2 * Math.PI * hz * i) / rate));

describe("wav", () => {
  it("downsamples 48 kHz to 16 kHz with the right length across buffers", () => {
    const down = createDownsampler(48_000);
    const input = tone(48_000, 1);
    let total = 0;
    for (let i = 0; i < input.length; i += 4096) total += down(input.subarray(i, i + 4096)).length;
    expect(total).toBe(16_000);
  });

  it("handles a non-integer ratio (44.1 kHz)", () => {
    const down = createDownsampler(44_100);
    const input = tone(44_100, 2);
    let total = 0;
    for (let i = 0; i < input.length; i += 4096) total += down(input.subarray(i, i + 4096)).length;
    expect(Math.abs(total - 32_000)).toBeLessThanOrEqual(1);
  });

  it("encodes and parses a 16 kHz mono WAV", () => {
    const pcm = createDownsampler(48_000)(tone(48_000, 0.5));
    const wav = encodeWav([pcm]);
    expect(wav.length).toBe(44 + pcm.length * 2);
    const parsed = parseWav(wav);
    expect(parsed).toMatchObject({ sampleRate: WAV_SAMPLE_RATE, channels: 1 });
    expect(Array.from(parsed.samples.subarray(0, 50))).toEqual(Array.from(pcm.subarray(0, 50)));
  });

  it("rejects non-WAV data", () => {
    expect(() => parseWav(new TextEncoder().encode("not a wav file at all"))).toThrow();
  });

  it("converts WAV to a much smaller MP3", () => {
    const pcm = createDownsampler(48_000)(tone(48_000, 3));
    const wav = encodeWav([pcm]);
    const mp3 = wavToMp3(wav);
    // MP3 frame sync (0xFFE…) at the start, ~48 kbps × 3 s ≈ 18 KB vs 96 KB WAV
    expect(mp3[0]).toBe(0xff);
    expect(mp3[1] & 0xe0).toBe(0xe0);
    expect(mp3.length).toBeGreaterThan(10_000);
    expect(mp3.length).toBeLessThan(wav.length / 3);
  });
});

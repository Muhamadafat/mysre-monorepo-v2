/**
 * WAV helpers shared by the browser recorder and the upload route.
 *
 * Recordings are WAV PCM 16-bit, mono, 16 kHz (~1.9 MB per minute): the
 * sample rate speech recognisers use. The server turns each WAV into an MP3
 * copy (see mp3.ts) — the MP3 is what plays in the history and goes to AI.
 */

export const WAV_SAMPLE_RATE = 16_000;

/**
 * Downsamples mono float samples from `fromRate` to `toRate` by averaging
 * every input sample that falls in one output sample (a box low-pass, good
 * enough for speech). `carry` holds the fractional position between calls so
 * consecutive buffers join without clicks.
 */
export function createDownsampler(fromRate: number, toRate: number = WAV_SAMPLE_RATE) {
  const ratio = fromRate / toRate;
  let filled = 0; // input samples gathered toward the next output sample
  let sum = 0;
  let count = 0;
  return (input: Float32Array): Int16Array => {
    if (ratio <= 1) return floatToInt16(input);
    const out = new Float32Array(Math.ceil(input.length / ratio) + 1);
    let n = 0;
    for (let i = 0; i < input.length; i++) {
      sum += input[i];
      count++;
      filled += 1;
      if (filled >= ratio) {
        out[n++] = sum / count;
        filled -= ratio;
        sum = 0;
        count = 0;
      }
    }
    return floatToInt16(out.subarray(0, n));
  };
}

export function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/** 44-byte RIFF header + the samples, as a WAV PCM 16-bit mono file. */
export function encodeWav(chunks: Int16Array[], sampleRate: number = WAV_SAMPLE_RATE): Uint8Array {
  const samples = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const dataBytes = samples * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  view.setUint32(40, dataBytes, true);
  let offset = 44;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++, offset += 2) view.setInt16(offset, chunk[i], true);
  }
  return new Uint8Array(buffer);
}

export interface ParsedWav {
  sampleRate: number;
  channels: number;
  /** Interleaved 16-bit samples. */
  samples: Int16Array;
}

/** Reads a WAV PCM 16-bit file (any chunk order). Throws on anything else. */
export function parseWav(bytes: Uint8Array): ParsedWav {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (bytes.byteLength < 12 || tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("bukan file WAV");
  let offset = 12;
  let format: { channels: number; sampleRate: number; bits: number; pcm: boolean } | null = null;
  while (offset + 8 <= bytes.byteLength) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt ") {
      format = {
        pcm: view.getUint16(body, true) === 1,
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bits: view.getUint16(body + 14, true),
      };
    } else if (id === "data") {
      if (!format) throw new Error("WAV tanpa format");
      if (!format.pcm || format.bits !== 16) throw new Error("WAV harus PCM 16-bit");
      const length = Math.min(size, bytes.byteLength - body) & ~1;
      // Copy: the data may start at an odd offset, which Int16Array can't view.
      const samples = new Int16Array(length / 2);
      for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(body + i * 2, true);
      return { sampleRate: format.sampleRate, channels: format.channels, samples };
    }
    offset = body + size + (size & 1); // chunks are padded to even sizes
  }
  throw new Error("WAV tanpa data audio");
}

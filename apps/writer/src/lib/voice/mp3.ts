import { Mp3Encoder } from "@breezystack/lamejs";
import { parseWav } from "./wav";

/**
 * WAV → MP3 on the server (lamejs, pure JS). Server-only: keeps the encoder
 * out of the browser bundle. 48 kbps at 16 kHz mono is clear for speech
 * (~0.36 MB per minute); this MP3 is the file sent to AI transcription.
 */
export const MP3_KBPS = 48;
const FRAME = 1152; // samples per MP3 frame

export function wavToMp3(wav: Uint8Array, kbps: number = MP3_KBPS): Uint8Array {
  const { sampleRate, channels, samples } = parseWav(wav);
  if (channels < 1 || channels > 2) throw new Error(`WAV ${channels} kanal tidak didukung`);
  const encoder = new Mp3Encoder(channels, sampleRate, kbps);
  const parts: Uint8Array[] = [];

  if (channels === 1) {
    for (let i = 0; i < samples.length; i += FRAME) parts.push(encoder.encodeBuffer(samples.subarray(i, i + FRAME)));
  } else {
    const frames = samples.length / 2;
    const left = new Int16Array(frames);
    const right = new Int16Array(frames);
    for (let i = 0; i < frames; i++) {
      left[i] = samples[i * 2];
      right[i] = samples[i * 2 + 1];
    }
    for (let i = 0; i < frames; i += FRAME) {
      parts.push(encoder.encodeBuffer(left.subarray(i, i + FRAME), right.subarray(i, i + FRAME)));
    }
  }
  parts.push(encoder.flush());

  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

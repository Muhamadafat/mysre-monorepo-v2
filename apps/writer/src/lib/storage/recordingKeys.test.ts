import { describe, expect, it } from "vitest";
import { buildRecordingKeys, isOwnRecordingKey, keyTimestamp, normalisePrefix, recordingFolder, safeSegment } from "./recordingKeys";

const date = new Date(2026, 10, 11, 9, 15, 2); // local time

describe("recording keys", () => {
  it("builds the USER/PROJECT/AUDIO_<MODE>/ layout", () => {
    const { audioKey, metaKey } = buildRecordingKeys({
      prefix: "dev",
      userId: "user123",
      projectId: "proj9",
      mode: "perintah",
      recId: "ab12cd34",
      date,
      extension: "mp3",
    });
    expect(audioKey).toBe("dev/user123/proj9/AUDIO_PERINTAH/user123_proj9_audioperintah_ab12cd34_20261111-091502.mp3");
    expect(metaKey).toBe("dev/user123/proj9/AUDIO_PERINTAH/user123_proj9_audioperintah_ab12cd34_20261111-091502.json");
  });

  it("puts menulis recordings in AUDIO_MENULIS and handles a missing project", () => {
    expect(recordingFolder("", "u1", null, "menulis")).toBe("u1/tanpa-project/AUDIO_MENULIS/");
  });

  it("strips unsafe characters from ids", () => {
    expect(safeSegment("../../etc/passwd", "x")).toBe("etcpasswd");
    expect(safeSegment("", "fallback")).toBe("fallback");
  });

  it("normalises the prefix", () => {
    expect(normalisePrefix(undefined)).toBe("");
    expect(normalisePrefix("/dev/")).toBe("dev/");
    expect(normalisePrefix("prod")).toBe("prod/");
  });

  it("formats the timestamp", () => {
    expect(keyTimestamp(date)).toBe("20261111-091502");
  });

  it("only accepts the user's own audio keys", () => {
    const own = "dev/u1/p1/AUDIO_MENULIS/u1_p1_audiomenulis_ab_20261111-091502.mp3";
    expect(isOwnRecordingKey(own, "dev", "u1")).toBe(true);
    expect(isOwnRecordingKey(own, "dev", "u2")).toBe(false); // someone else's
    expect(isOwnRecordingKey("dev/u1/p1/PDF_UPLOAD/a.pdf", "dev", "u1")).toBe(false); // not audio
    expect(isOwnRecordingKey("dev/u1/p1/AUDIO_MENULIS/x.json", "dev", "u1")).toBe(false); // metadata
    expect(isOwnRecordingKey("dev/u1/../u2/p1/AUDIO_MENULIS/a.mp3", "dev", "u1")).toBe(false); // traversal
    expect(isOwnRecordingKey("dev/u10/p1/AUDIO_MENULIS/a.mp3", "dev", "u1")).toBe(false); // prefix lookalike
  });
});

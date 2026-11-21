import { describe, expect, test } from "vitest";
import { createCopilotLimiter } from "./copilotLimit";

/** A limiter whose clock the test moves by hand. */
function setup(perMinute = 20, perDay = 500) {
  let now = new Date("2026-10-28T10:00:00");
  const allow = createCopilotLimiter({ perMinute, perDay }, () => now);
  const advance = (ms: number) => (now = new Date(now.getTime() + ms));
  const repeat = (userId: string, times: number) => Array.from({ length: times }, () => allow(userId));
  return { allow, advance, repeat };
}

describe("createCopilotLimiter: batas saran otomatis per user", () => {
  test("20 permintaan dalam semenit diizinkan, ke-21 ditolak", () => {
    const { allow, repeat } = setup();
    expect(repeat("user-a", 20).every(Boolean)).toBe(true);
    expect(allow("user-a")).toBe(false);
  });

  test("setelah satu menit lewat, user boleh meminta lagi", () => {
    const { allow, advance, repeat } = setup();
    repeat("user-a", 21);
    advance(60_000);
    expect(allow("user-a")).toBe(true);
  });

  test("batas satu user tidak mengganggu user lain", () => {
    const { allow, repeat } = setup();
    repeat("user-a", 21);
    expect(allow("user-b")).toBe(true);
  });

  test("batas harian berlaku walau tiap menit masih di bawah batas", () => {
    const { allow, advance, repeat } = setup(20, 50);
    for (let minute = 0; minute < 3; minute++) {
      repeat("user-a", 20);
      advance(60_000);
    }
    expect(allow("user-a")).toBe(false);
  });

  test("batas harian kembali nol keesokan harinya", () => {
    const { allow, advance, repeat } = setup(20, 5);
    repeat("user-a", 6);
    advance(24 * 60 * 60_000);
    expect(allow("user-a")).toBe(true);
  });
});

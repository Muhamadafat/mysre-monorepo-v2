import { describe, expect, it, vi } from "vitest";

// adminAuth imports next/headers (cookies), which only exists inside Next.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {} }) }));

import { adminLoginProblem } from "./adminAuth";
import { createLoginThrottle } from "./loginThrottle";

const prod = (env: Record<string, string>) => ({ NODE_ENV: "production", ...env }) as unknown as NodeJS.ProcessEnv;

describe("adminLoginProblem (production)", () => {
  it("refuses when the env vars are missing", () => {
    expect(adminLoginProblem(prod({}))).toMatch(/belum diisi/);
  });
  it("refuses the old default and other weak passwords", () => {
    expect(adminLoginProblem(prod({ ADMIN_USERNAME: "admin", ADMIN_PASSWORD: "admin123" }))).not.toBeNull();
    expect(adminLoginProblem(prod({ ADMIN_USERNAME: "dosen", ADMIN_PASSWORD: "pendek" }))).toMatch(/minimal/);
    expect(adminLoginProblem(prod({ ADMIN_USERNAME: "penelitian1234", ADMIN_PASSWORD: "PENELITIAN1234" }))).toMatch(/mudah/);
  });
  it("accepts a strong password", () => {
    expect(adminLoginProblem(prod({ ADMIN_USERNAME: "tim-riset", ADMIN_PASSWORD: "Kuat-dan-Panjang-2026!" }))).toBeNull();
  });
  it("never blocks local dev", () => {
    expect(adminLoginProblem({ NODE_ENV: "development" } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });
});

describe("createLoginThrottle", () => {
  it("locks after 5 failures and unlocks after the window", () => {
    const t = createLoginThrottle({ maxFailures: 5, windowMs: 60_000 });
    for (let i = 0; i < 5; i++) t.fail("ip", 1000);
    expect(t.retryAfter("ip", 2000)).toBeGreaterThan(0);
    expect(t.retryAfter("other", 2000)).toBe(0);
    expect(t.retryAfter("ip", 62_000)).toBe(0);
  });
  it("a success clears the count", () => {
    const t = createLoginThrottle({ maxFailures: 2, windowMs: 60_000 });
    t.fail("ip", 0);
    t.succeed("ip");
    t.fail("ip", 1);
    expect(t.retryAfter("ip", 2)).toBe(0);
  });
});

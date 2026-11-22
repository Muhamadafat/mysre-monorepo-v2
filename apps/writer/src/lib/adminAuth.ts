import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Login for the penelitian page (/penelitian): one account, no DB, set with
 * ADMIN_USERNAME / ADMIN_PASSWORD in apps/writer/.env (adminLoginProblem
 * says what production requires).
 * The cookie is a short JWT signed with AUTH_SECRET, so it can't be forged.
 */
export const ADMIN_COOKIE = "sre_admin";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

const isProduction = () => process.env.NODE_ENV === "production";

// The admin/admin123 fallback is for local dev only; production never uses it.
export const adminUsername = () => process.env.ADMIN_USERNAME || (isProduction() ? "" : "admin");
export const adminPassword = () => process.env.ADMIN_PASSWORD || (isProduction() ? "" : "admin123");

const WEAK_PASSWORDS = new Set([
  "admin", "admin123", "password", "password123", "penelitian", "peneliti", "12345678", "123456789012",
]);
export const MIN_PASSWORD_LENGTH = 12;

/**
 * Why the penelitian login is switched off, or null when it may be used.
 * In production it stays off until the server has its own ADMIN_USERNAME and
 * a strong ADMIN_PASSWORD, so a forgotten env var never opens it up.
 */
export function adminLoginProblem(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.NODE_ENV !== "production") return null;
  const username = env.ADMIN_USERNAME ?? "";
  const password = env.ADMIN_PASSWORD ?? "";
  if (!username || !password) return "ADMIN_USERNAME / ADMIN_PASSWORD belum diisi di server.";
  if (password.length < MIN_PASSWORD_LENGTH) return `ADMIN_PASSWORD minimal ${MIN_PASSWORD_LENGTH} karakter.`;
  const lower = password.toLowerCase();
  if (WEAK_PASSWORDS.has(lower) || lower === username.toLowerCase()) return "ADMIN_PASSWORD terlalu mudah ditebak.";
  return null;
}

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET env var is not set");
  return new TextEncoder().encode(`admin:${value}`);
}

/** Constant-time-ish compare so the password can't be guessed by timing. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function checkAdminLogin(username: string, password: string): boolean {
  if (adminLoginProblem()) return false;
  return same(username, adminUsername()) && same(password, adminPassword());
}

export async function setAdminCookie(): Promise<void> {
  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(adminUsername())
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearAdminCookie(): Promise<void> {
  (await cookies()).set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
}

/** True when the request carries a valid admin cookie. */
export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.role === "admin";
  } catch {
    return false;
  }
}

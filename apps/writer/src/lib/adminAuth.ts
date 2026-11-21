import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Login for the admin page (/admin): one hard-coded account, no DB.
 * Change it with ADMIN_USERNAME / ADMIN_PASSWORD in apps/writer/.env.
 * The cookie is a short JWT signed with AUTH_SECRET, so it can't be forged.
 */
export const ADMIN_COOKIE = "sre_admin";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

export const adminUsername = () => process.env.ADMIN_USERNAME || "admin";
export const adminPassword = () => process.env.ADMIN_PASSWORD || "admin123";

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

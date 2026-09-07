// Server-only auth: password hashing + JWT session cookie.
// Replaces Supabase Auth. Never import this from a Client Component.
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE_NAME = 'sre_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export interface AppSession {
  user: SessionUser;
  expires_at: number; // unix seconds
}

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET env var is not set');
  return new TextEncoder().encode(secret);
}

function cookieOptions() {
  return {
    domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN || '.lvh.me',
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<AppSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (!payload.sub || !payload.exp) return null;
    return {
      user: {
        id: payload.sub,
        email: payload.email as string,
        name: (payload.name as string) ?? null,
        role: payload.role as string,
      },
      expires_at: payload.exp,
    };
  } catch {
    return null;
  }
}

export async function getServerSession(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = await signSessionToken(user);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, cookieOptions());
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, '', { ...cookieOptions(), maxAge: 0 });
}

export function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

// Server-only: high-level auth operations built on auth.ts + email.ts + prisma.
// This is the single source of truth for signup/signin/signout/password-reset
// logic — every app's route/action should call these instead of reimplementing them.
import { prisma } from './prisma';
import {
  hashPassword,
  verifyPassword,
  setSessionCookie,
  clearSessionCookie,
  generateToken,
  type SessionUser,
} from './auth';
import { sendVerificationEmail, sendPasswordResetEmail } from './email';

export class AuthError extends Error {}

function toSessionUser(user: { id: string; email: string; name: string | null; role: string }): SessionUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function registerUser({
  email,
  password,
  name,
  ...extra
}: {
  email: string;
  password: string;
  name?: string;
  [key: string]: unknown;
}) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AuthError('Email already registered');

  const hashed = await hashPassword(password);
  const emailVerifyToken = generateToken();
  const user = await prisma.user.create({
    data: {
      email,
      password: hashed,
      name: name || email.split('@')[0],
      role: 'USER',
      emailVerifyToken,
      ...extra,
    },
  });

  try {
    await sendVerificationEmail(email, emailVerifyToken);
  } catch (e) {
    console.error('Failed to send verification email:', e);
  }

  await setSessionCookie(toSessionUser(user));
  return user;
}

export async function authenticateUser({ email, password }: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AuthError('Invalid email or password');

  const valid = await verifyPassword(password, user.password);
  if (!valid) throw new AuthError('Invalid email or password');

  await setSessionCookie(toSessionUser(user));
  return user;
}

export async function signOutUser() {
  await clearSessionCookie();
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return; // don't leak whether the email exists

  const token = generateToken();
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: token, passwordResetExpires: expires },
  });

  try {
    await sendPasswordResetEmail(email, token);
  } catch (e) {
    console.error('Failed to send password reset email:', e);
  }
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  const user = await prisma.user.findFirst({ where: { passwordResetToken: token } });
  if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
    throw new AuthError('Invalid or expired reset token');
  }

  const hashed = await hashPassword(newPassword);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed, passwordResetToken: null, passwordResetExpires: null },
  });

  await setSessionCookie(toSessionUser(updated));
  return updated;
}

export async function changeUserPassword(userId: string, newPassword: string) {
  const hashed = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
}

export async function verifyEmailWithToken(token: string) {
  const user = await prisma.user.findFirst({ where: { emailVerifyToken: token } });
  if (!user) throw new AuthError('Invalid verification token');

  await prisma.user.update({
    where: { id: user.id },
    data: { isEmailVerified: true, emailVerifyToken: null },
  });
  return user;
}

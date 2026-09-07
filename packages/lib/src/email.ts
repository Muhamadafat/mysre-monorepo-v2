// Server-only: transactional email via Resend. Replaces Supabase Auth emails.
import { Resend } from 'resend';

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY env var is not set');
  return new Resend(apiKey);
}

const FROM = process.env.RESEND_FROM_EMAIL || 'no-reply@sre-monorepo.local';
const MAIN_APP_URL = process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://main.lvh.me:3000';

export async function sendVerificationEmail(to: string, token: string) {
  const link = `${MAIN_APP_URL}/api/auth/confirm?type=signup&token=${token}`;
  await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Verify your email',
    html: `<p>Click the link below to verify your email address:</p><p><a href="${link}">${link}</a></p>`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${MAIN_APP_URL}/reset-password?token=${token}`;
  await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Reset your password',
    html: `<p>Click the link below to reset your password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour.</p>`,
  });
}

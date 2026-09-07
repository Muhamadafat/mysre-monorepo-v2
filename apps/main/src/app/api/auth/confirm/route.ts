// app/api/auth/confirm/route.ts
// Handles the signup email-verification link (see packages/lib/src/email.ts
// sendVerificationEmail). Password reset no longer goes through this route —
// its email link points straight at /reset-password?token=...
import { type NextRequest, NextResponse } from 'next/server';
import { verifyEmailWithToken, AuthError } from '@sre-monorepo/lib/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const baseUrl = process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://main.lvh.me:3000';

  if (!token) {
    const errorUrl = new URL('/signin', baseUrl);
    errorUrl.searchParams.set('error', 'Missing verification token');
    return NextResponse.redirect(errorUrl);
  }

  try {
    await verifyEmailWithToken(token);
    const redirectUrl = new URL('/signin', baseUrl);
    redirectUrl.searchParams.set('verified', 'true');
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    const errorUrl = new URL('/signin', baseUrl);
    errorUrl.searchParams.set('error', error instanceof AuthError ? error.message : 'Could not verify token');
    return NextResponse.redirect(errorUrl);
  }
}

import { type EmailOtpType } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sre-monorepo/lib';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/';

  let response = NextResponse.redirect(new URL('/signin', request.url));
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{
          name: string;
          value: string;
          options: CookieOptions;
        }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({ name, value, ...options });
            response.cookies.set({ name, value, ...options });
          });
        },
      },
    }
  );

  const createSuccessResponse = (pathname: string) => {
    const url = new URL(pathname, request.url);
    url.searchParams.set('verified', 'true');
    return NextResponse.redirect(url);
  };

  const createErrorResponse = (message: string) => {
    const url = new URL('/signin', request.url);
    url.searchParams.set('error', message);
    return NextResponse.redirect(url);
  };

  const syncVerifiedUser = async (
    userId: string,
    email?: string | null,
    name?: string | null
  ) => {
    if (!email) {
      throw new Error('Supabase user email is missing during verification sync');
    }

    await prisma.user.upsert({
      where: { id: userId },
      update: {
        email,
        isEmailVerified: true,
        updatedAt: new Date(),
      },
      create: {
        id: userId,
        email,
        name: name ?? email,
        password: '',
        role: 'USER',
        isEmailVerified: true,
      },
    });
  };

  if (code) {
    const isPasswordReset =
      next.includes('reset-password') || next.includes('update-password');
    response = createSuccessResponse(
      isPasswordReset ? '/update-password' : next
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      if (!isPasswordReset) {
        await syncVerifiedUser(
          data.session.user.id,
          data.session.user.email,
          data.session.user.user_metadata?.name
        );
      }
      return response;
    }

    return createErrorResponse('Could not verify code');
  }

  if (tokenHash && type) {
    const isPasswordReset = type === 'recovery' || type === 'email_change';
    response = createSuccessResponse(
      isPasswordReset ? '/update-password' : next
    );

    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      if (type !== 'recovery' && data.session?.user) {
        await syncVerifiedUser(
          data.session.user.id,
          data.session.user.email,
          data.session.user.user_metadata?.name
        );
      }
      return response;
    }

    return createErrorResponse('Could not verify token');
  }

  return createErrorResponse('Could not verify token');
}

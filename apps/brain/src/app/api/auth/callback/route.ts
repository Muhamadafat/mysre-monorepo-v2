// apps/brain/src/app/api/auth/callback/route.ts
// Menerima access_token dari main app dan membuat session di brain
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const access_token = searchParams.get('access_token');
  const refresh_token = searchParams.get('refresh_token');
  const redirectTo = searchParams.get('next') || '/';
  const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
  const shouldSetCookieDomain =
    !!cookieDomain && !cookieDomain.includes('localhost');

  if (code) {
    // Standard OAuth flow
    const response = NextResponse.redirect(`${origin}${redirectTo}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return [];
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set({
                name,
                value,
                ...options,
                // Ensure session cookies are readable by the browser Supabase client
                // (`createBrowserClient`), otherwise `getSession()` returns null.
                httpOnly: false,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                ...(shouldSetCookieDomain ? { domain: cookieDomain } : {}),
              });
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('Error exchanging code for session:', error);
    return NextResponse.redirect(
      `${origin}/error?message=${encodeURIComponent(error.message)}`
    );
  }

    return response;
  }

  if (access_token && refresh_token) {
    // Token-based flow dari main app
    const response = NextResponse.redirect(`${origin}${redirectTo}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return [];
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set({
                name,
                value,
                ...options,
                httpOnly: false,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                ...(shouldSetCookieDomain ? { domain: cookieDomain } : {}),
              });
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error) {
      console.error('Error setting session:', error);
      const mainAppUrl =
        process.env.NEXT_PUBLIC_MAIN_APP_URL || 'https://mysrepanel.web.id';
      return NextResponse.redirect(
        `${mainAppUrl}/signin?error=${encodeURIComponent('Session error: ' + error.message)}`
      );
    }

    return response;
  }

  // Tidak ada token apapun, redirect ke signin main
  const mainAppUrl =
    process.env.NEXT_PUBLIC_MAIN_APP_URL || 'https://mysrepanel.web.id';
  return NextResponse.redirect(`${mainAppUrl}/signin?redirectedFrom=brain`);
}

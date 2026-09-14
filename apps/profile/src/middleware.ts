// apps/brain/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@sre-monorepo/lib';
import { sendXapiFromMiddleware } from '@sre-monorepo/lib';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware untuk API routes, static files, dan _next
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  try {
    const supabase = await createServerSupabaseClient();
    // Menggunakan getUser() untuk keamanan sesuai peringatan Supabase,
    // lalu mengambil sesi jika user valid untuk pelacakan analitik.
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    // Jika pengguna tidak terautentikasi dan mencoba mengakses rute yang dilindungi
    if (userError || !user) {
      // Redirect ke main app signin
      const redirectUrl = new URL(
        '/signin',
        process.env.NEXT_PUBLIC_MAIN_APP_URL ||
          'https://mysrepanel.web.id'
      );
      // Gunakan public site URL + pathname, bukan request.url,
      // karena request.url di server berisi alamat upstream (http://[redacted-host]:3002)
      const publicOrigin =
        process.env.NEXT_PUBLIC_SITE_URL ||
        'https://profile.mysrepanel.web.id';
      redirectUrl.searchParams.set(
        'redirectedFrom',
        `${publicOrigin}${request.nextUrl.pathname}`
      );

      console.log(
        'Profile: Redirecting unauthenticated user to:',
        redirectUrl.toString()
      );
      return NextResponse.redirect(redirectUrl);
    }

    // Ambil session hanya jika user sudah tervalidasi untuk xAPI tracking
    const { data: { session } } = await supabase.auth.getSession();

    // Enhanced debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log('=== PROFILE MIDDLEWARE DEBUG ===');
      console.log('Pathname:', pathname);
      console.log('User exists:', !!user);
      console.log('User email:', user?.email);
      console.log('User error:', userError);
      console.log('Cookies:', request.headers.get('cookie'));
      console.log('================================');
    }

    //generate session fallback jika null
    const expiresAt = session?.expires_at || Math.floor(Date.now() / 1000) + 3600;
    const projectId = `${user.id}_${Math.floor(expiresAt)}`;

    // Track page visits di profile app (AUTOMATIC)
    await sendXapiFromMiddleware(
      {
        verb: {
          id: 'http://adlnet.gov/expapi/verbs/experienced',
          display: { 'en-US': 'viewed' },
        },
        object: {
          id: `profile${pathname}`,
          definition: {
            name: { 'en-US': `Profile App - ${pathname}` },
            type: 'http://adlnet.gov/expapi/activities/lesson',
          },
        },
        context: {
          extensions: {
            projectId: projectId,
            flowStep: 'profile',
            currentPath: pathname,
            supabaseUserId: user.id,
          },
        },
      },
      session,
      'profile',
      request
    );

    // Jika user sudah authenticated dan di root, biarkan lewat (tidak perlu redirect lagi)
    // Karena sekarang root adalah halaman utama brain app

    // Set headers untuk debugging
    const response = NextResponse.next();
    response.headers.set('X-Authenticated', session ? 'true' : 'false');
    response.headers.set('X-User-Email', session?.user?.email || '');
    response.headers.set('X-Middleware', 'brain-passed');
    //tambah for xapi
    response.headers.set('X-Session-Id', projectId);
    response.headers.set('X-Page-Enter-Time', Date.now().toString());
    response.headers.set('X-Middleware', 'profile-passed');

    return response;
  } catch (error) {
    console.error('Brain Middleware error:', error);

    // Jika terjadi error, redirect ke main app signin
    const redirectUrl = new URL(
      '/signin',
      process.env.NEXT_PUBLIC_MAIN_APP_URL ||
        'https://mysrepanel.web.id'
    );
    return NextResponse.redirect(redirectUrl);
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|public).*)'],
};

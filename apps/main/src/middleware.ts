// apps/main/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { sendXapiFromMiddleware } from '@sre-monorepo/lib';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set({ name, value, ...options });
              response = NextResponse.next({
                request: {
                  headers: request.headers,
                },
              });
              response.cookies.set({ name, value, ...options });
            });
          },
        },
      }
    );

    await supabase.auth.getUser();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { pathname } = request.nextUrl;

    //for xapi
    let projectId = null;
    if (session) {
      projectId = `${session.user.id}_${Math.floor(session.expires_at! / 1000)}`;
    }

    if (session && projectId) {
      await sendXapiFromMiddleware(
        {
          verb: {
            id: 'http://adlnet.gov/expapi/verbs/experienced',
            display: { 'en-US': 'viewed' },
          },
          object: {
            id: `main${pathname}`,
            definition: {
              name: { 'en-US': `Main App - ${pathname}` },
              type: 'http://adlnet.gov/expapi/activities/lesson',
            },
          },
          context: {
            extensions: {
              projectId: projectId,
              flowStep: 'main',
              currentPath: pathname,
              supabaseUserId: session.user.id,
              sessionExpiry: session.expires_at,
            },
          },
        },
        session,
        'main',
        request
      );
    }

    // Debug logging untuk development
    if (process.env.NODE_ENV === 'development') {
      console.log('=== MAIN MIDDLEWARE DEBUG ===');
      console.log('Pathname:', pathname);
      console.log('Session exists:', !!session);
      console.log('User email:', session?.user?.email);
      console.log('==============================');
    }

    // Jika pengguna sudah terautentikasi dan mencoba mengakses signin/signup
    if (session && (pathname === '/signin' || pathname === '/signup')) {
      //trak event xapi
      await sendXapiFromMiddleware(
        {
          verb: {
            id: 'http://adlnet.gov/expapi/verbs/skipped',
            display: { 'en-US': 'skipped' },
          },
          object: {
            id: `main${pathname}`,
            definition: {
              name: { 'en-US': `Already authenticated - skipped ${pathname}` },
              type: 'http://adlnet.gov/expapi/activities/interaction',
            },
          },
          context: {
            extensions: {
              projectId: projectId,
              flowStep: 'authentication-skip',
              redirectTo: 'profile/dashboard',
            },
          },
        },
        session,
        'main',
        request
      );

      const redirectUrl = new URL(
        '/dashboard',
        process.env.NEXT_PUBLIC_PROFILE_APP_URL ||
          'https://profile.mysrepanel.web.id'
      );
      console.log(
        'User already authenticated, redirecting to brain app root:',
        redirectUrl.toString()
      );
      return NextResponse.redirect(redirectUrl);
    }

    // Jika pengguna terautentikasi dan mengakses root, redirect ke brain app
    if (session && pathname === '/') {
      const redirectUrl = new URL(
        '/dashboard',
        process.env.NEXT_PUBLIC_PROFILE_APP_URL ||
          'https://profile.mysrepanel.web.id'
      );
      console.log(
        'Authenticated user accessing root, redirecting to brain app:',
        redirectUrl.toString()
      );
      return NextResponse.redirect(redirectUrl);
    }

    return response;
  } catch (error) {
    console.error('Main App Middleware error:', error);
    return response;
  }
}

export const config = {
  matcher: ['/', '/signin', '/signup'],
};

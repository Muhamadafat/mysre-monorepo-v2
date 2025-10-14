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
    const { data: { session }, error } = await supabase.auth.getSession();
    
    // Enhanced debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log('=== BRAIN MIDDLEWARE DEBUG ===');
      console.log('Pathname:', pathname);
      console.log('Session exists:', !!session);
      console.log('Session user:', session?.user?.email);
      console.log('Session error:', error);
      console.log('Cookies:', request.headers.get('cookie'));
      console.log('================================');
    }

    // Jika pengguna tidak terautentikasi dan mencoba mengakses rute yang dilindungi
    if (!session ) {
      // Redirect ke main app signin
      const redirectUrl = new URL('/signin', process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://main.lvh.me:3000');
      redirectUrl.searchParams.set('redirectedFrom', request.url);
      
      console.log('Brain: Redirecting unauthenticated user to:', redirectUrl.toString());
      return NextResponse.redirect(redirectUrl);
    }

    const profileUrl = new URL('/api/check-group', request.url);
    const profileResponse = await fetch(profileUrl.toString(), {
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
    });

    if (!profileResponse.ok) {
      console.error("Brain: failed to fetch user group", profileResponse.status);
      const redirectUrl = new URL('/signin', process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://main.lvh.me:3000');
      redirectUrl.searchParams.set('error', 'fetch_group_failed');
      return NextResponse.redirect(redirectUrl);
    }

    const { group, email } = await profileResponse.json();

    if (group !== 'A'){
      console.log('Brain: Access denied - User is not in Group A:', {
        userId: session.user.id,
        email: email,
        group: group
      });

      const redirectUrl = new URL('/', process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://main.lvh.me:3000');
      redirectUrl.searchParams.set('error', 'access_denied');
      redirectUrl.searchParams.set('message', 'Brain app feature is only for group A users.');
      return NextResponse.redirect(redirectUrl);
    }

    console.log('Brain: Access granted for Group A user:', {
      userId: session.user.id,
      email: email,
      group: group
    });

    // const dbUser = await prisma.user.findUnique({
    //   where: { id: session.user.id },
    //   select: {
    //     id: true,
    //     email: true,
    //     group: true,
    //   },
    // });

    // if (!dbUser){
    //   console.log("Brain: User not found");
    //   const redirectUrl = new URL('/signin', process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://main.lvh.me:3000');
    //   redirectUrl.searchParams.set('error', 'user_not_found');
    //   return NextResponse.redirect(redirectUrl);
    // }

    // if (dbUser.group !== 'A'){
    //   console.log("Brain: User not group A");
    //   const redirectUrl = new URL('/', process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://main.lvh.me:3000');
    //   redirectUrl.searchParams.set('error', 'access_denied');
    //   redirectUrl.searchParams.set('message', 'Brain feature is only for group A users.');
    //   return NextResponse.redirect(redirectUrl);
    // }

    //generate sessionid
    const sessionId = `${session.user.id}_${Math.floor(session.expires_at! / 1000)}`;

    // Track page visits di brain/IDE app (AUTOMATIC)
    await sendXapiFromMiddleware({
      verb: {
        id: "http://adlnet.gov/expapi/verbs/experienced",
        display: { "en-US": "viewed" }
      },
      object: {
        id: `brain${pathname}`,
        definition: {
          name: { "en-US": `Brain App - ${pathname}` },
          type: "http://adlnet.gov/expapi/activities/lesson"
        }
      },
      context: {
        extensions: {
          sessionId: sessionId,
          flowStep: "brain",
          currentPath: pathname,
          activityType: "project-brain",
          supabaseUserId: session.user.id
        }
      }
    }, session, "brain", request);

    // Jika user sudah authenticated dan di root, biarkan lewat (tidak perlu redirect lagi)
    // Karena sekarang root adalah halaman utama brain app

    // Set headers untuk debugging
    const response = NextResponse.next();
    response.headers.set('X-Authenticated', session ? 'true' : 'false');
    response.headers.set('X-User-Email', session?.user?.email || '');
    response.headers.set('X-Middleware', 'brain-passed');
    response.headers.set('X-Session-Id', sessionId);
    response.headers.set('X-Page-Enter-Time', Date.now().toString());

    return response;
  } catch (error) {
    console.error('Brain Middleware error:', error);
    
    // Jika terjadi error, redirect ke main app signin
    const redirectUrl = new URL('/signin', process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://main.lvh.me:3000');
    return NextResponse.redirect(redirectUrl);
  }
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
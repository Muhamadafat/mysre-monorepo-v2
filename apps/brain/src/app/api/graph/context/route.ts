import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@sre-monorepo/lib';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = request.nextUrl.searchParams.get('project_id');
    if (!projectId) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      );
    }

    const pyUrl = process.env.PY_URL || process.env.NEXT_PUBLIC_FASTAPI_URL;
    if (!pyUrl) {
      return NextResponse.json(
        { error: 'Backend service URL not configured' },
        { status: 503 }
      );
    }

    const upstreamUrl = new URL('/api/graph/context', pyUrl);
    upstreamUrl.searchParams.set('project_id', projectId);

    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      signal: request.signal,
      cache: 'no-store',
    });

    const contentType = upstreamResponse.headers.get('content-type') || '';
    const bodyText = await upstreamResponse.text();

    if (!upstreamResponse.ok) {
      try {
        return NextResponse.json(JSON.parse(bodyText), {
          status: upstreamResponse.status,
        });
      } catch {
        return NextResponse.json(
          { error: bodyText || 'Failed to fetch graph context' },
          { status: upstreamResponse.status }
        );
      }
    }

    if (contentType.includes('application/json')) {
      try {
        return NextResponse.json(JSON.parse(bodyText), { status: 200 });
      } catch {
        return new NextResponse(bodyText, {
          status: 200,
          headers: { 'content-type': contentType },
        });
      }
    }

    return new NextResponse(bodyText, {
      status: 200,
      headers: { 'content-type': contentType || 'text/plain' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to connect';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, getSessionToken } from '@sre-monorepo/lib/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function resolveUpstreamUrl(request: NextRequest, fastApiUrl: string): string {
  const upstreamUrl = new URL('/mcp/upload/stream', fastApiUrl);
  const jobId = request.nextUrl.searchParams.get('job_id');
  const projectId = request.nextUrl.searchParams.get('project_id');

  if (jobId) {
    upstreamUrl.searchParams.set('job_id', jobId);
  }

  if (projectId) {
    upstreamUrl.searchParams.set('project_id', projectId);
  }

  return upstreamUrl.toString();
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionToken = await getSessionToken();
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const fastApiUrl =
      process.env.PY_URL || process.env.NEXT_PUBLIC_FASTAPI_URL;
    if (!fastApiUrl) {
      return NextResponse.json(
        { error: 'Backend service URL not configured' },
        { status: 503 }
      );
    }

    const upstreamResponse = await fetch(
      resolveUpstreamUrl(request, fastApiUrl),
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          Accept: 'text/event-stream',
        },
        signal: request.signal,
      }
    );

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text().catch(() => '');
      return NextResponse.json(
        {
          error:
            errorText ||
            `Progress stream failed with status ${upstreamResponse.status}`,
        },
        { status: upstreamResponse.status }
      );
    }

    const headers = new Headers();
    headers.set('Content-Type', 'text/event-stream');
    headers.set('Cache-Control', 'no-cache, no-transform');
    headers.set('X-Accel-Buffering', 'no');

    const contentType = upstreamResponse.headers.get('content-type');
    if (contentType) {
      headers.set('Content-Type', contentType);
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to connect';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, getSessionToken } from '@sre-monorepo/lib/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ node_id: string }> }
) {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { node_id: nodeId } = await params;
    if (!nodeId) {
      return NextResponse.json({ error: 'node_id is required' }, { status: 400 });
    }

    const pyUrl = process.env.PY_URL || process.env.NEXT_PUBLIC_FASTAPI_URL;
    if (!pyUrl) {
      return NextResponse.json(
        { error: 'Backend service URL not configured' },
        { status: 503 }
      );
    }

    const sessionToken = await getSessionToken();
    const upstreamResponse = await fetch(
      new URL(`/api/graph/literature/${encodeURIComponent(nodeId)}`, pyUrl),
      {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        signal: request.signal,
      }
    );

    const contentType = upstreamResponse.headers.get('content-type') || '';
    const bodyText = await upstreamResponse.text();

    if (!upstreamResponse.ok) {
      try {
        return NextResponse.json(JSON.parse(bodyText), {
          status: upstreamResponse.status,
        });
      } catch {
        return NextResponse.json(
          { error: bodyText || 'Failed to delete literature node' },
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

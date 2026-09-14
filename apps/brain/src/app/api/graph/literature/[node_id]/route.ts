import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@sre-monorepo/lib';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { node_id: string } }
) {
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

    const nodeId = params.node_id;
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

    const upstreamResponse = await fetch(
      new URL(`/api/graph/literature/${encodeURIComponent(nodeId)}`, pyUrl),
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
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

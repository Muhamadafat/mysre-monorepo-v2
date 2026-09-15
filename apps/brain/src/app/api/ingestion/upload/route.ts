import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, getSessionToken } from '@sre-monorepo/lib/server';

const FASTAPI_UPLOAD_PATH = {
  upload: '/mcp/upload',
  submit: '/mcp/upload/submit',
} as const;

type UploadMode = keyof typeof FASTAPI_UPLOAD_PATH;

function resolveUploadMode(request: NextRequest): UploadMode {
  const rawMode = request.nextUrl.searchParams.get('mode');
  if (rawMode === 'submit') {
    return 'submit';
  }

  return 'upload';
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Missing session. User is not authenticated.' },
        { status: 401 }
      );
    }

    const sessionToken = await getSessionToken();
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Missing session token. User is not authenticated.' },
        { status: 401 }
      );
    }

    const fastApiUrl =
      process.env.PY_URL || process.env.NEXT_PUBLIC_FASTAPI_URL;
    if (!fastApiUrl) {
      return NextResponse.json(
        { error: 'Backend service URL not configured' },
        { status: 503 }
      );
    }

    const incomingForm = await request.formData();
    const upstreamForm = new FormData();

    for (const [key, value] of incomingForm.entries()) {
      upstreamForm.append(key, value);
    }

    const uploadMode = resolveUploadMode(request);
    const upstreamUrl = `${fastApiUrl}${FASTAPI_UPLOAD_PATH[uploadMode]}`;

    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
      body: upstreamForm,
    });

    const contentType = upstreamResponse.headers.get('content-type') || '';

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text().catch(() => '');
      return NextResponse.json(
        {
          error:
            errorText || `Upload failed with status ${upstreamResponse.status}`,
        },
        { status: upstreamResponse.status }
      );
    }

    if (contentType.includes('application/json')) {
      const data = await upstreamResponse.json();
      return NextResponse.json(data, { status: 200 });
    }

    const text = await upstreamResponse.text();
    return new NextResponse(text, {
      status: 200,
      headers: {
        'content-type': contentType || 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

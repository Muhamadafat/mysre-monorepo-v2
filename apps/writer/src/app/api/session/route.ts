// apps/brain/src/app/api/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@sre-monorepo/lib/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const sessionId = `${session.user.id}_${Math.floor(session.expires_at / 1000)}`;

    return NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name
      },
      expires_at: session.expires_at,
      sessionId: sessionId
    });
  } catch (error) {
    return NextResponse.json({ error: 'Session fetch failed' }, { status: 500 });
  }
}
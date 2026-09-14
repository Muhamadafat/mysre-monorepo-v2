// apps/main/src/app/api/session/route.ts
// Endpoint untuk mengambil session data (termasuk group) untuk routing setelah login.
import { NextResponse } from 'next/server';
import { getServerSession, prisma } from '@sre-monorepo/lib/server';

export async function GET() {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ error: 'No session' }, { status: 401 });
    }

    let group: string | null = null;
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { group: true },
      });
      group = dbUser?.group ?? null;
    } catch (dbErr) {
      console.error('DB error fetching group:', dbErr);
    }

    return NextResponse.json({
      expires_at: session.expires_at,
      group,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        group,
      },
    });
  } catch (err) {
    console.error('Session API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

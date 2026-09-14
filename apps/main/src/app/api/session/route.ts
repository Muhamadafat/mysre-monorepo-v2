// apps/main/src/app/api/session/route.ts
// Endpoint untuk mengambil session data termasuk access_token dan refresh_token
// Digunakan oleh LoginForm untuk routing berdasarkan group + token passing ke brain
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@sre-monorepo/lib';
import { prisma } from '@sre-monorepo/lib';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session) {
      return NextResponse.json({ error: 'No session' }, { status: 401 });
    }

    // Ambil group dari database
    let group: string | null = null;
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { group: true },
      });
      group = dbUser?.group ?? null;
    } catch (dbErr) {
      console.error('DB error fetching group:', dbErr);
      // Fallback ke metadata
      group =
        session.user.user_metadata?.group ??
        session.user.app_metadata?.group ??
        null;
    }

    return NextResponse.json({
      projectId: session.access_token, // legacy field
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      group,
      user: {
        id: session.user.id,
        email: session.user.email,
        user_metadata: {
          ...session.user.user_metadata,
          group: group ?? session.user.user_metadata?.group,
        },
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

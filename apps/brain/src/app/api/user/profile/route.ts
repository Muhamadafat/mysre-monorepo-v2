import { type NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@sre-monorepo/lib';
import { prisma } from '@sre-monorepo/lib';

export async function GET(request: NextRequest) {
  try {
    console.log('=== API PROFILE START ===');

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    console.log('Supabase user:', !!user);
    console.log('Supabase error:', error);

    if (error || !user) {
      console.log('❌ Not authenticated');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('Looking for user ID:', user.id);

    // Ambil dari database. Prioritas tetap by id, tapi fallback by email
    // supaya row lama yang belum selaras dengan auth user tetap kebaca.
    const dbUserById = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        group: true,
        nim: true,
      },
    });

    const dbUser =
      dbUserById ??
      (user.email
        ? await prisma.user.findUnique({
            where: { email: user.email },
            select: {
              id: true,
              email: true,
              name: true,
              group: true,
              nim: true,
            },
          })
        : null);

    console.log('Database user found:', !!dbUser);
    console.log('Database user data:', dbUser);

    if (dbUser) {
      if (dbUserById == null && dbUser.email === user.email) {
        console.warn(
          'User profile matched by email fallback because auth id row was missing:',
          {
            sessionUserId: user.id,
            dbUserId: dbUser.id,
            email: dbUser.email,
          }
        );
      }

      const result = {
        user: {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          group: dbUser.group,
          nim: dbUser.nim,
        },
      };

      console.log('✅ Returning user data:', result);
      console.log('=== API PROFILE END ===');

      return NextResponse.json(result);
    }

    // Jika tidak ada di database (seharusnya tidak terjadi berdasarkan debug)
    console.log('❌ User not found in database');
    return NextResponse.json(
      { error: 'User not found in database' },
      { status: 404 }
    );
  } catch (error) {
    console.error('💥 API Profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { prisma } from '@sre-monorepo/lib';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@sre-monorepo/lib'; // asumsi file kamu tadi

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin':
    process.env.NODE_ENV === 'development' ? '*' : 'https://yourdomain.com',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, Cookie, X-Requested-With',
  'Access-Control-Allow-Credentials': 'true',
};

async function resolveDbUser(authUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}) {
  const dbUserById = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      email: true,
      name: true,
      group: true,
    },
  });

  if (dbUserById) {
    return dbUserById;
  }

  const dbUserByEmail =
    authUser.email != null
      ? await prisma.user.findUnique({
          where: { email: authUser.email },
          select: {
            id: true,
            email: true,
            name: true,
            group: true,
          },
        })
      : null;

  if (dbUserByEmail) {
    return dbUserByEmail;
  }

  const fallbackName =
    authUser.user_metadata?.name ??
    authUser.user_metadata?.full_name ??
    authUser.email ??
    'User';
  const fallbackGroup =
    authUser.user_metadata?.group ?? authUser.app_metadata?.group ?? null;

  return prisma.user.create({
    data: {
      id: authUser.id,
      email: authUser.email ?? fallbackName,
      name: fallbackName,
      password: '',
      role: 'USER',
      isEmailVerified: true,
      group: fallbackGroup,
    },
    select: {
      id: true,
      email: true,
      name: true,
      group: true,
    },
  });
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await resolveDbUser(user);
    const body = await req.json();
    const { title, description, coverColor } = body;

    const session = await prisma.project.create({
      data: {
        title,
        description,
        coverColor,
        userId: dbUser.id,
        selectedFilterArticles: [],
        //   graphFilters: JSON[],
        lastActivity: new Date(),
      },
    });

    return NextResponse.json({ id: session.id });
  } catch (error) {
    console.error('API POST project error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('API: Getting projects');

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json([], { status: 401 });
    }

    const dbUser = await resolveDbUser(user);
    const sessions = await prisma.project.findMany({
      where: {
        userId: dbUser.id,
      },
      include: {
        _count: {
          select: {
            articles: true,
            chatMessages: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('API GET projects error:', error);
    // Kembalikan array kosong dengan status 500 agar frontend tidak crash saat parsing JSON
    return NextResponse.json([], {
      status: 500,
      headers: { 'X-Error': 'Internal Server Error' },
    });
  }
}

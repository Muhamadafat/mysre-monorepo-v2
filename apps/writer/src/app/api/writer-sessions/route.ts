import { prisma } from '@sre-monorepo/lib/server';
import { NextResponse } from 'next/server';
import { getServerSession } from '@sre-monorepo/lib/server';

export async function POST(req: Request) {
  const session = await getServerSession();
  const user = session?.user;

  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { title, description, coverColor } = body;

  const writerSession = await prisma.writerSession.create({
    data: {
      title,
      description,
      coverColor: coverColor || '#4c6ef5', // default color dari schema
      userId: user.id,
      lastActivity: new Date(),
    },
  });

  return NextResponse.json({ id: writerSession.id });
}

// app/api/writer-sessions/route.ts
export async function GET() {
  const session = await getServerSession();
  const user = session?.user;

  if (!user) {
    return NextResponse.json([], { status: 401 });
  }

  const writerSessions = await prisma.writerSession.findMany({
    where: {
      userId: user.id,
    },
    include: {
      _count: {
        select: {
          drafts: true, 
        },
      },
      user: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  return NextResponse.json(writerSessions);
}
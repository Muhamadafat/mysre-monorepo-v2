import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sre-monorepo/lib/server';
import { getServerSession } from '@sre-monorepo/lib/server';
import { canAccessWriterSession, isWriterSessionOwner } from '@/lib/writerSessionAccess';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: writerSessionId } = await params;
  const session = await getServerSession();
  const user = session?.user;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await canAccessWriterSession(writerSessionId, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [writerSession, collaborators] = await Promise.all([
    prisma.writerSession.findUnique({
      where: { id: writerSessionId },
      select: { userId: true, user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.writerSessionCollaborator.findMany({
      where: { writerSessionId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return NextResponse.json({
    owner: writerSession?.user ?? null,
    collaborators,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: writerSessionId } = await params;
  const session = await getServerSession();
  const user = session?.user;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await isWriterSessionOwner(writerSessionId, user.id))) {
    return NextResponse.json({ error: 'Hanya pemilik yang bisa menambah kolaborator' }, { status: 403 });
  }

  const { userId } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: 'userId wajib diisi' }, { status: 400 });
  }

  if (userId === user.id) {
    return NextResponse.json({ error: 'Pemilik sudah otomatis punya akses' }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!targetUser) {
    return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
  }

  const collaborator = await prisma.writerSessionCollaborator.upsert({
    where: { writerSessionId_userId: { writerSessionId, userId } },
    update: {},
    create: { writerSessionId, userId, role: 'editor' },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ collaborator }, { status: 201 });
}

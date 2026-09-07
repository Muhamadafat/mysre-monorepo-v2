import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sre-monorepo/lib/server';
import { getServerSession } from '@sre-monorepo/lib/server';
import { isWriterSessionOwner } from '@/lib/writerSessionAccess';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: writerSessionId } = await params;
  const session = await getServerSession();
  const user = session?.user;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await isWriterSessionOwner(writerSessionId, user.id))) {
    return NextResponse.json({ error: 'Hanya pemilik yang bisa melihat link undangan' }, { status: 403 });
  }

  const writerSession = await prisma.writerSession.findUnique({
    where: { id: writerSessionId },
    select: { shareToken: true },
  });

  return NextResponse.json({ token: writerSession?.shareToken ?? null });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: writerSessionId } = await params;
  const session = await getServerSession();
  const user = session?.user;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await isWriterSessionOwner(writerSessionId, user.id))) {
    return NextResponse.json({ error: 'Hanya pemilik yang bisa membuat link undangan' }, { status: 403 });
  }

  const token = randomUUID();
  await prisma.writerSession.update({
    where: { id: writerSessionId },
    data: { shareToken: token },
  });

  return NextResponse.json({ token });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: writerSessionId } = await params;
  const session = await getServerSession();
  const user = session?.user;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await isWriterSessionOwner(writerSessionId, user.id))) {
    return NextResponse.json({ error: 'Hanya pemilik yang bisa menonaktifkan link undangan' }, { status: 403 });
  }

  await prisma.writerSession.update({
    where: { id: writerSessionId },
    data: { shareToken: null },
  });

  return NextResponse.json({ success: true });
}

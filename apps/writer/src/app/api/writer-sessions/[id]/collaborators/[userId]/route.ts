import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sre-monorepo/lib/server';
import { getServerSession } from '@sre-monorepo/lib/server';
import { isWriterSessionOwner } from '@/lib/writerSessionAccess';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id: writerSessionId, userId } = await params;
  const session = await getServerSession();
  const user = session?.user;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await isWriterSessionOwner(writerSessionId, user.id))) {
    return NextResponse.json({ error: 'Hanya pemilik yang bisa menghapus kolaborator' }, { status: 403 });
  }

  await prisma.writerSessionCollaborator.deleteMany({
    where: { writerSessionId, userId },
  });

  return NextResponse.json({ success: true });
}

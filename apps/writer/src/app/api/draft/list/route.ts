import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sre-monorepo/lib/server';
import { getServerSession } from '@sre-monorepo/lib/server';
import { canAccessWriterSession } from '@/lib/writerSessionAccess';

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  const user = session?.user;

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const writerSessionId = searchParams.get('writerSessionId');

    if (!writerSessionId) {
      return NextResponse.json({ 
        message: "Missing writerSessionId" 
      }, { status: 400 });
    }

    if (!(await canAccessWriterSession(writerSessionId, user.id))) {
      return NextResponse.json({ drafts: [] });
    }

    // Version history is shared: every owner/collaborator sees all snapshots
    // for this writer session, not just their own.
    const drafts = await prisma.draft.findMany({
      where: {
        writerId: writerSessionId,
      },
      include: {
        sections: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ drafts });

  } catch (error) {
    console.error('Error loading drafts:', error);
    return NextResponse.json({ 
      message: "Internal server error" 
    }, { status: 500 });
  }
}
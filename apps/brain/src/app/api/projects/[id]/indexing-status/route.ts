import { NextResponse } from 'next/server';
import { prisma } from '@sre-monorepo/lib';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pendingCount = await prisma.documentChunk.count({
      where: {
        projectId: id,
        embeddingStatus: { in: ['PENDING', 'PROCESSING'] },
      },
    });

    const failedCount = await prisma.documentChunk.count({
      where: {
        projectId: id,
        embeddingStatus: 'FAILED',
      },
    });

    return NextResponse.json({
      isIndexing: pendingCount > 0,
      hasError: failedCount > 0,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal memuat status' }, { status: 500 });
  }
}

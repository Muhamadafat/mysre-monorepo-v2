/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { prisma, getServerSession } from '@sre-monorepo/lib/server';

/**
 * POST /api/annotation/comparative
 * Menyimpan catatan dari hasil analisis komparatif.
 * Tidak memerlukan att_url — langsung pakai articleId pertama dari analisis.
 * Body: { articleId, highlightedText, tabLabel, projectId }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  const user = session.user;

  const body = await req.json();
  const { articleId, highlightedText, tabLabel, projectId, comment } = body as {
    articleId?: string;
    highlightedText?: string;
    tabLabel?: string;
    projectId?: string;
    comment?: string;
  };

  if (!highlightedText?.trim()) {
    return NextResponse.json(
      { message: 'highlightedText is required' },
      { status: 400 }
    );
  }

  try {
    // Cari article yang valid untuk session ini
    // Catatan: "projectId" di kontrak API ini adalah BrainstormingSession.id (disebut
    // "project" di URL/UI, tapi kolomnya di Article adalah sessionId).
    let resolvedArticleId = articleId;

    if (!resolvedArticleId && projectId) {
      // Fallback: ambil artikel pertama di session
      const article = await prisma.article.findFirst({
        where: { sessionId: projectId },
        select: { id: true },
      });
      resolvedArticleId = article?.id;
    }

    if (!resolvedArticleId) {
      return NextResponse.json(
        { message: 'No article found for this session' },
        { status: 404 }
      );
    }

    const newAnnotation = await prisma.annotation.create({
      data: {
        articleId: resolvedArticleId,
        page: 0, // tidak ada halaman PDF
        highlightedText: highlightedText.trim(),
        comment: comment || '',
        semanticTag: tabLabel || 'Analisis Komparatif', // label tab sebagai sumber
        userId: user.id,
      },
      include: {
        article: {
          select: { id: true, title: true, filePath: true, sessionId: true },
        },
      },
    });

    return NextResponse.json(newAnnotation, { status: 200 });
  } catch (error: any) {
    console.error('[ANNOTATION_COMPARATIVE_ERROR]', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

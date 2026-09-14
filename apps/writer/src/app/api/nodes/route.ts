/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sre-monorepo/lib';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userIdFromUrl = searchParams.get('userId'); // userId (bisa dari URL atau current user)
    const projectId = searchParams.get('projectId'); // projectId atau writerSessionId

    console.log('=== NODES API DEBUG ===');
    console.log('1. Raw userId:', userIdFromUrl);
    console.log('2. Raw projectId:', projectId);

    if (!userIdFromUrl) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    // Clean userId jika mengandung underscore (misal dari format legacy)
    let cleanUserId = userIdFromUrl;
    if (userIdFromUrl.includes('_')) {
      cleanUserId = userIdFromUrl.split('_')[0];
      console.log('3. Cleaned userId:', cleanUserId);
    }

    // Ambil semua articles yang terkait dengan project ini
    const articles = await prisma.article.findMany({
      where: {
        projectId: projectId,
        userId: cleanUserId,
      },
      include: {
        annotations: true,
      },
    });

    console.log(`4. Found ${articles.length} articles for this project`);

    // Mapping data untuk graph visualization (bisa dikembangkan lagi)
    return NextResponse.json({
      success: true,
      articleCount: articles.length,
      articles: articles.map((a) => ({
        id: a.id,
        title: a.title,
        annotationCount: a.annotations.length,
      })),
    });
  } catch (error: any) {
    console.error('❌ Error in nodes API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sre-monorepo/lib';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    const articles = await prisma.article.findMany({
      where: {
        projectId: projectId || undefined,
      },
      select: {
        id: true,
        title: true,
        filePath: true,
      },
    });

    return NextResponse.json(articles);
  } catch (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sre-monorepo/lib';
import { createServerSupabaseClient } from '@sre-monorepo/lib';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      articleId,
      page,
      highlightedText,
      comment,
      semanticTag,
      draftSectionId,
      userId,
    } = body;

    if (!userId || !articleId) {
      return NextResponse.json(
        { message: 'userId and articleId are required' },
        { status: 400 }
      );
    }

    const newAnnotation = await prisma.annotation.create({
      data: {
        userId,
        articleId,
        page,
        highlightedText,
        comment,
        semanticTag,
        draftSectionId,
      },
    });

    return NextResponse.json(newAnnotation, { status: 201 });
  } catch (error) {
    console.error('[ANNOTATION_ERROR]', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const projectId = searchParams.get('projectId'); // Project ID
  const writerSessionId = searchParams.get('writerSessionId'); // WriterSession ID

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Ambil anotasi berdasarkan projectId (Brainstorming) atau writerSessionId
    let annotations = [];

    if (projectId) {
      annotations = await prisma.annotation.findMany({
        where: {
          article: {
            projectId: projectId,
          },
          userId: user.id,
        },
        include: {
          article: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } else if (writerSessionId) {
      annotations = await prisma.annotation.findMany({
        where: {
          article: {
            project: {
              writerSessions: {
                some: {
                  id: writerSessionId,
                },
              },
            },
          },
          userId: user.id,
        },
        include: {
          article: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } else {
      // Jika tidak ada filter, ambil semua anotasi milik user
      annotations = await prisma.annotation.findMany({
        where: {
          userId: user.id,
        },
        include: {
          article: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    return NextResponse.json(annotations);
  } catch (error) {
    console.error('[ANNOTATION_GET_ERROR]', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

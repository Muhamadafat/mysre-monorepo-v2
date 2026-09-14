import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sre-monorepo/lib';
import { createServerSupabaseClient } from '@sre-monorepo/lib';

// api/annotation/route.ts - POST method
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const metadata = body?.metadata;
  const document = body?.document;

  if (!metadata || !document) {
    return NextResponse.json(
      { message: 'Missing document in metadata' },
      { status: 400 }
    );
  }

  try {
    // PERBAIKAN: Cari artikel berdasarkan filePath (document URL) karena tabel Node sudah dihapus.
    const article = await prisma.article.findFirst({
      where: { filePath: document },
      select: {
        id: true,
        title: true,
        filePath: true,
        projectId: true,
      },
    });

    if (!article) {
      return NextResponse.json(
        { message: `Article not found for URL: ${document}` },
        { status: 404 }
      );
    }

    // ✅ Simpan positionData di semanticTag sebagai JSON string
    const newAnnotation = await prisma.annotation.create({
      data: {
        articleId: article.id,
        page: metadata.pageNumber,
        highlightedText: metadata.highlightedText || '',
        comment: metadata.contents || '',
        semanticTag: metadata.positionData || null, // ✅ Simpan position data di sini
        userId: user.id,
      },
      include: {
        article: {
          select: {
            id: true,
            title: true,
            filePath: true,
            projectId: true,
          },
        },
      },
    });

    console.log('✅ Annotation saved:', {
      id: newAnnotation.id,
      articleId: article.id,
      projectId: article.projectId,
      hasPositionData: !!newAnnotation.semanticTag,
    });

    return NextResponse.json(newAnnotation, { status: 200 });
  } catch (error) {
    console.error('[ANNOTATION_ERROR]', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// api/annotation/route.ts - GET method
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const projectId = searchParams.get('projectId');

  console.log('🔍 GET /api/annotation called');
  console.log('📋 Request details:', {
    projectId,
    url: req.url,
    searchParams: Object.fromEntries(searchParams),
  });

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  console.log('👤 User from Supabase:', {
    userId: user?.id,
    email: user?.email,
    hasUser: !!user,
  });

  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  if (!projectId) {
    console.log('❌ No projectId provided');
    return NextResponse.json(
      { message: 'projectId is required' },
      { status: 400 }
    );
  }

  try {
    // ✅ STEP 1: Cek dulu semua articles di session ini
    const articlesInSession = await prisma.article.findMany({
      where: {
        projectId: projectId,
      },
      select: {
        id: true,
        title: true,
        filePath: true,
        projectId: true,
      },
    });

    console.log(
      '📚 Articles in session:',
      articlesInSession.length,
      articlesInSession
    );

    // ✅ STEP 2: Cek semua annotations untuk user ini (tanpa filter session dulu)
    const allUserAnnotations = await prisma.annotation.findMany({
      where: {
        userId: user.id,
      },
      include: {
        article: {
          select: {
            id: true,
            title: true,
            filePath: true,
            projectId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(
      '📝 All user annotations:',
      allUserAnnotations.length,
      allUserAnnotations.map((a) => ({
        id: a.id,
        articleId: a.articleId,
        articleSessionId: a.article?.projectId,
        targetSessionId: projectId,
        match: a.article?.projectId === projectId,
      }))
    );

    // ✅ STEP 3: Filter annotations untuk session ini
    const annotations = await prisma.annotation.findMany({
      where: {
        userId: user.id,
        article: {
          projectId: projectId,
        },
      },
      include: {
        article: {
          select: {
            id: true,
            title: true,
            filePath: true,
            projectId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(
      '✅ Filtered annotations for session:',
      annotations.length,
      annotations
    );

    return NextResponse.json(annotations, { status: 200 });
  } catch (error) {
    console.error('❌ Error fetching annotations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch annotations' },
      { status: 500 }
    );
  }
}

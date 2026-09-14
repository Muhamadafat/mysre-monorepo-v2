import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sre-monorepo/lib';

export async function DELETE(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  const { id: idParam } = await params;

  try {
    // PERBAIKAN: Langsung cek Article ID karena tabel Node sudah dihapus.
    const articleId = idParam;
    const existingArticle = await prisma.article.findUnique({
      where: {
        id: articleId,
      },
    });

    if (!existingArticle) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Delete the article (cascade deletes will handle related records)
    await prisma.article.delete({
      where: {
        id: articleId,
      },
    });

    return NextResponse.json(
      {
        msg: 'Article deleted successfully',
        articleId: articleId,
        providedId: idParam,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting article:', error);
    return NextResponse.json(
      { error: 'Failed to delete article' },
      { status: 500 }
    );
  }
}

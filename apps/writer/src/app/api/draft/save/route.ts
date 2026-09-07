import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sre-monorepo/lib/server';
import { getServerSession } from '@sre-monorepo/lib/server';
import { canAccessWriterSession } from '@/lib/writerSessionAccess';

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  const user = session?.user;

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { 
      writerSessionId, 
      title, 
      contentBlocks, 
      wordCount 
    } = await req.json();

    if (!writerSessionId || !contentBlocks) {
      return NextResponse.json({
        message: "Missing required fields"
      }, { status: 400 });
    }

    if (!(await canAccessWriterSession(writerSessionId, user.id))) {
      return NextResponse.json({
        message: "Access denied to this writer session"
      }, { status: 403 });
    }

    console.log('💾 Saving draft with blocks:', contentBlocks.length);

    // Buat Draft baru
    const draft = await prisma.draft.create({
      data: {
        userId: user.id,
        writerId: writerSessionId,
        title: title || `Draft ${new Date().toISOString()}`,
      },
    });

    // Helper function untuk extract text dari block content
    const extractText = (content: any): string => {
      if (!content) return '';
      if (typeof content === 'string') return content;
      if (Array.isArray(content)) {
        return content
          .map((item: any) => {
            if (typeof item === 'string') return item;
            if (item?.text) return item.text;
            if (item?.type === 'text' && item?.text) return item.text;
            return '';
          })
          .join('')
          .trim();
      }
      return '';
    };

    // PENTING: Simpan sebagai JSON untuk preserve structure
    const sectionsData = [];
    
    for (let i = 0; i < contentBlocks.length; i++) {
      const block = contentBlocks[i];
      const blockText = extractText(block.content);
      
      // Skip empty blocks
      if (!blockText.trim()) continue;

      // Simpan setiap block sebagai section terpisah dengan metadata lengkap
      sectionsData.push({
        draftId: draft.id,
        title: blockText.substring(0, 100), // Truncate for title
        content: JSON.stringify({
          type: block.type,
          props: block.props || {},
          content: blockText,
          originalBlock: block, // Simpan full block structure
          order: i // CRITICAL: Simpan order untuk preserve urutan
        }),
      });
    }

    // Jika tidak ada sections, buat satu default
    if (sectionsData.length === 0) {
      sectionsData.push({
        draftId: draft.id,
        title: title || 'Empty Draft',
        content: JSON.stringify({
          type: 'paragraph',
          props: {},
          content: '',
          order: 0
        }),
      });
    }

    console.log('💾 Saving sections:', sectionsData.length);

    // Insert sections ke database
    await prisma.draftSection.createMany({
      data: sectionsData,
    });

    // Return draft dengan sections
    const completeDraft = await prisma.draft.findUnique({
      where: { id: draft.id },
      include: {
        sections: {
          orderBy: {
            id: 'asc' // Order by creation
          }
        },
      }
    });

    return NextResponse.json({ 
      success: true,
      draft: completeDraft,
      wordCount,
      sectionsCount: sectionsData.length
    });

  } catch (error) {
    console.error('❌ Error saving draft:', error);
    return NextResponse.json({ 
      message: "Internal server error",
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
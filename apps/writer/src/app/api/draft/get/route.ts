/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sre-monorepo/lib';
import { createServerSupabaseClient } from '@sre-monorepo/lib';

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const draftId = searchParams.get('draftId');

    if (!draftId) {
      return NextResponse.json(
        {
          message: 'Missing draftId',
        },
        { status: 400 }
      );
    }

    const draft = await prisma.draft.findUnique({
      where: {
        id: draftId,
        userId: user.id, // Ensure user owns this draft
      },
      include: {
        sections: {
          orderBy: {
            id: 'asc', // CRITICAL: Order by ID to preserve creation order
          },
        },
      },
    });

    if (!draft) {
      return NextResponse.json(
        {
          message: 'Draft not found',
        },
        { status: 404 }
      );
    }

    console.log('📖 Loading draft with sections:', draft.sections.length);

    // Parse sections back to BlockNote format with proper ordering
    const parsedSections = draft.sections
      .map((section) => {
        try {
          const parsed = JSON.parse(section.content);
          return {
            ...parsed,
            sectionId: section.id, // Keep section ID for reference
          };
        } catch (e) {
          console.warn(
            '⚠️ Failed to parse section, using fallback:',
            section.id
          );
          // Fallback: treat as plain text paragraph
          return {
            type: 'paragraph',
            props: {},
            content: section.content,
            order: 999999, // Put unparseable content at end
            sectionId: section.id,
          };
        }
      })
      .sort((a, b) => (a.order || 0) - (b.order || 0)); // CRITICAL: Sort by saved order

    console.log('📖 Parsed sections:', parsedSections.length);

    // Reconstruct BlockNote blocks
    const editorBlocks: any[] = [];

    parsedSections.forEach((section) => {
      // Reconstruct original block structure
      if (section.originalBlock) {
        // Use original block if available (preferred)
        editorBlocks.push(section.originalBlock);
      } else {
        // Fallback: reconstruct from saved data
        const block: any = {
          type: section.type || 'paragraph',
          props: section.props || {},
        };

        // Handle content based on type
        if (section.type === 'heading') {
          block.content = section.content || '';
        } else if (section.type === 'paragraph') {
          block.content = section.content || '';
        } else {
          // Other block types
          block.content = section.content || '';
        }

        editorBlocks.push(block);
      }
    });

    // If no content, add empty paragraph
    if (editorBlocks.length === 0) {
      editorBlocks.push({
        type: 'paragraph',
        content: '',
      });
    }

    console.log('✅ Reconstructed blocks:', editorBlocks.length);
    console.log(
      '📋 Block types:',
      editorBlocks
        .map((b) => `${b.type}${b.props?.level ? `-${b.props.level}` : ''}`)
        .join(', ')
    );

    return NextResponse.json({
      success: true,
      draft: {
        id: draft.id,
        title: draft.title,
        createdAt: draft.createdAt,
        sections: draft.sections,
      },
      editorContent: editorBlocks,
    });
  } catch (error) {
    console.error('❌ Error loading draft:', error);
    return NextResponse.json(
      {
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

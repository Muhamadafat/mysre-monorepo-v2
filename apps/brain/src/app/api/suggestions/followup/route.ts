import { NextResponse } from 'next/server';
import { buildFollowupSuggestions } from '../suggestionPrompts';

type SuggestionNodeSummary = {
  id: string;
  title?: string | null;
  label?: string | null;
  articleId?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const lastMessage =
      typeof body.lastMessage === 'string' ? body.lastMessage : '';
    const chatMode = body.chatMode === 'RESEARCH' ? 'RESEARCH' : 'STRICT';
    const selectedNodes = Array.isArray(body?.context?.selectedNodes)
      ? (body.context.selectedNodes as SuggestionNodeSummary[])
      : [];

    const suggestions = buildFollowupSuggestions({
      lastMessage,
      chatMode,
      context: {
        nodeIds: Array.isArray(body?.context?.nodeIds)
          ? body.context.nodeIds
          : [],
        edgeIds: Array.isArray(body?.context?.edgeIds)
          ? body.context.edgeIds
          : [],
        selectedNodes,
      },
    });

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Failed to build follow-up suggestions', error);
    return NextResponse.json(
      {
        suggestions: [
          'Apa pertanyaan lanjutan yang relevan?',
          'Apa langkah analisis berikutnya?',
          'Apa aspek yang perlu diperdalam?',
        ],
      },
      { status: 200 }
    );
  }
}

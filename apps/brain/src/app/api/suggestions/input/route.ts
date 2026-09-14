import { NextRequest, NextResponse } from 'next/server';
import { buildInputSuggestions } from '../suggestionPrompts';

type SuggestionNodeSummary = {
  id: string;
  title?: string | null;
  label?: string | null;
  articleId?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = typeof body.query === 'string' ? body.query : '';
    const mode =
      body.mode === 'single node' || body.mode === 'multiple node'
        ? body.mode
        : 'general';
    const chatMode = body.chatMode === 'RESEARCH' ? 'RESEARCH' : 'STRICT';
    const selectedNodes = Array.isArray(body?.context?.selectedNodes)
      ? (body.context.selectedNodes as SuggestionNodeSummary[])
      : [];

    const suggestions = buildInputSuggestions({
      query,
      mode,
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
    console.error('Failed to build input suggestions', error);
    return NextResponse.json(
      {
        suggestions: [
          'Apa topik utama yang ingin dianalisis?',
          'Bantu saya mulai dari inti pembahasan',
          'Apa pertanyaan paling penting di sini?',
        ],
      },
      { status: 200 }
    );
  }
}

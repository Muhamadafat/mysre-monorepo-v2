/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sre-monorepo/lib';
import { createServerSupabaseClient } from '@sre-monorepo/lib';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, mode, question, forceWeb } = body;

  console.log('perceived:', projectId);

  let thereIsNode: boolean = false;

  if (mode === 'single node' || mode === 'multiple node') {
    thereIsNode = true;
  } else {
    thereIsNode = false;
  }

  // contextNodeIds yang diterima dari frontend adalah ID Node Prisma dan TETAP AKAN DIKIRIM APA ADANYA KE PYTHON
  // untuk digunakan oleh GraphDB.
  // Kita tidak perlu lagi mengambil ArticleId via Prisma karena relasi tersebut sudah tidak ada.

  if (thereIsNode) {
    try {
      //this for main.py(fastapi)

      // const ragAnswer = await fetch(`${process.env.PY_URL}/api/chat`, {
      // method: "POST",
      // headers: {
      //     'Content-Type': 'application/json',
      // },
      // body: JSON.stringify({
      //     question: prompt,
      //     project_id: projectId,
      //     mode: mode === 'single node' ? 'single_node' : 'multi_nodes',
      //     node_id: nodeId,
      //     node_ids: nodeIds,
      //     context_node_ids: contextNodeIds,
      //     context_edge_ids: contextEdgeIds,
      //     force_web: false
      // }),
      // signal: AbortSignal.timeout(30000)
      // });

      // PERBAIKAN: Menghapus panggilan ke endpoint /mcp yang sudah usang dan menghasilkan 404.
      // Fitur chat sekarang ditangani sepenuhnya oleh /api/chat/stream_pral.
      // Rute ini dipertahankan hanya sebagai fallback dummy untuk mencegah crash UI lama.
      const dummyResponse = {
        answer:
          'Fitur ini telah dinonaktifkan. Silakan gunakan antarmuka chat terbaru yang mendukung RAG dinamis.',
        references: [],
        result: { content: [{ text: 'Fitur ini telah dinonaktifkan.' }] },
      };

      const ragData = dummyResponse;
      let answerText = ragData.answer;
      let references: any[] = [];

      return NextResponse.json({
        ...ragData,
        answer: answerText,
        references: references,
      });
    } catch (error) {
      console.error('Error in legacy chat route:', error);
      return NextResponse.json(
        { error: 'Endpoint deprecated' },
        { status: 502 }
      );
    }
  } else {
    if (forceWeb) {
      try {
        // Fallback dummy
        return NextResponse.json({
          answer: 'Fitur Web Search legacy telah dinonaktifkan.',
        });
      } catch (error) {
        console.error('Error fallback web search:', error);
      }
    } else {
      try {
        // Fallback dummy untuk general chat
        const dummyResponse = {
          answer:
            'Fitur general chat legacy telah dinonaktifkan. Gunakan antarmuka chat terbaru.',
          references: [],
          result: {
            content: [
              { text: 'Fitur general chat legacy telah dinonaktifkan.' },
            ],
          },
        };

        const ragData = dummyResponse;
        let answerText = ragData.answer;
        let references: any[] = [];

        return NextResponse.json({
          ...ragData,
          answer: answerText,
          references: references,
        });
      } catch (error) {
        console.error('Error in legacy general chat:', error);
        return NextResponse.json(
          { error: 'Endpoint deprecated' },
          { status: 502 }
        );
      }
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!user || error) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const chatSessionId = searchParams.get('chatSessionId');

    //add
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '3');
    const offset = (page - 1) * limit;

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    if (!chatSessionId) {
      return NextResponse.json(
        { error: 'chatSessionId is required' },
        { status: 400 }
      );
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    const session = await prisma.chatSession.findFirst({
      where: {
        id: chatSessionId,
        projectId,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Chat session not found or access denied' },
        { status: 404 }
      );
    }

    const totalTurns = await prisma.chatMessage.count({
      where: {
        projectId,
        chatSessionId,
        userId: user.id,
      },
    });

    const chatHistory = await prisma.chatMessage.findMany({
      where: {
        projectId,
        chatSessionId,
        userId: user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: offset,
      take: limit,
    });

    const reversedHistory = chatHistory.reverse();

    const flattenedMessages = reversedHistory.flatMap((turn) => [
      {
        id: `${turn.id}-user`,
        role: 'user',
        content: turn.userQuery,
        references: [],
      },
      {
        id: `${turn.id}-assistant`,
        role: 'assistant',
        content: turn.aiResponse,
        references: Array.isArray(turn.references) ? turn.references : [],
      },
    ]);

    const hasMore = offset + limit < totalTurns;

    return NextResponse.json({
      messages: flattenedMessages,
      total: totalTurns * 2,
      hasMore,
      currentPage: page,
      totalPages: Math.ceil(totalTurns / limit),
    });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

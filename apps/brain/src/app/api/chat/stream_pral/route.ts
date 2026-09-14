import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@sre-monorepo/lib';
import { createServerSupabaseClient } from '@sre-monorepo/lib';

type FinalEventPayload = {
  references?: unknown[];
  metrics?: Record<string, unknown>;
};

type JsonInput = Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;

type PersistableContextSnapshot = JsonInput;

const MAX_SESSION_TITLE_LENGTH = 80;
const MAX_LAST_PREVIEW_LENGTH = 240;

function normalizeContextSnapshot(
  contextSnapshot: unknown,
  activeHashes: string[]
): PersistableContextSnapshot {
  if (
    contextSnapshot &&
    typeof contextSnapshot === 'object' &&
    !Array.isArray(contextSnapshot)
  ) {
    return JSON.parse(JSON.stringify(contextSnapshot)) as Prisma.InputJsonValue;
  }

  return {
    documents: activeHashes.map((hash) => ({ hash })),
  };
}

function truncateText(value: string, maxLength: number): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function toJsonValue(value: unknown): JsonInput {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseSseEventBlock(block: string): {
  event: string | null;
  data: string;
} {
  const lines = block.split(/\r?\n/);
  let event: string | null = null;
  const dataLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line || line.startsWith(':')) {
      continue;
    }

    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim();
      continue;
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trim());
    }
  }

  return {
    event,
    data: dataLines.join('\n'),
  };
}

function isIgnorableHeartbeatFrame(rawBlock: string): boolean {
  const normalized = rawBlock.trim();

  if (!normalized) {
    return true;
  }

  if (normalized.startsWith(':')) {
    return true;
  }

  return /^ping\s*-\s*/i.test(normalized) || /^:?\s*ping\s*-\s*/i.test(normalized);
}

async function persistCompletedTurn(params: {
  projectId: string;
  chatSessionId: string;
  userId: string;
  question: string;
  aiResponse: string;
  references: unknown[];
  mode: 'STRICT' | 'RESEARCH';
  activeHashes: string[];
  contextSnapshot: PersistableContextSnapshot;
  metrics?: Record<string, unknown>;
}) {
  const {
    projectId,
    chatSessionId,
    userId,
    question,
    aiResponse,
    references,
    mode,
    activeHashes,
    contextSnapshot,
    metrics,
  } = params;

  const normalizedQuestion = question.trim();
  const normalizedAnswer = aiResponse.trim();

  await prisma.chatMessage.create({
    data: {
      projectId,
      userId,
      chatSessionId,
      userQuery: normalizedQuestion,
      aiResponse: normalizedAnswer,
      references: toJsonValue(references),
      metadata: toJsonValue({
        mode,
        activeHashes,
        metrics: metrics ?? null,
      }),
    },
  });

  const existingSession = await prisma.chatSession.findFirst({
    where: {
      id: chatSessionId,
      projectId,
      userId,
    },
    select: {
      id: true,
      title: true,
    },
  });

  if (!existingSession) {
    throw new Error('Chat session not found during persistence.');
  }

  await prisma.chatSession.update({
    where: {
      id: existingSession.id,
    },
    data: {
      title:
        existingSession.title === 'New Chat'
          ? truncateText(normalizedQuestion, MAX_SESSION_TITLE_LENGTH)
          : existingSession.title,
      lastPreview: truncateText(normalizedAnswer, MAX_LAST_PREVIEW_LENGTH),
      lastActivity: new Date(),
      mode,
      contextSnapshot: toJsonValue(contextSnapshot),
    },
  });
}

/**
 * POST /api/chat/stream_pral
 *
 * Server-Side Streaming Proxy untuk Agentic RAG Chatbot (PRAL).
 * Menerima nodeIds dari frontend, resolve ke articleIds (hash) via Prisma,
 * lalu mem-proxy request ke Python FastAPI streaming endpoint.
 *
 * Request body:
 *   - question: string
 *   - projectId: string
 *   - nodeIds: string[]
 *   - mode: "STRICT" | "RESEARCH"
 *
 * Response: Web Streams (text/plain, chunked) dari Python backend.
 */
export async function POST(req: NextRequest) {
  // -- 1. Autentikasi via Supabase Server Client --
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // -- 2. Parse dan validasi request body --
  let body: {
    question?: string;
    projectId?: string;
    chatSessionId?: string;
    activeHashes?: string[];
    mode?: string;
    contextSnapshot?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { question, projectId, chatSessionId, activeHashes, mode } = body;

  if (!question || !question.trim()) {
    return NextResponse.json(
      { error: 'question is required' },
      { status: 400 }
    );
  }

  if (!projectId) {
    return NextResponse.json(
      { error: 'projectId is required' },
      { status: 400 }
    );
  }

  if (
    !activeHashes ||
    !Array.isArray(activeHashes) ||
    activeHashes.length === 0
  ) {
    return NextResponse.json(
      { error: 'activeHashes must contain at least one document' },
      { status: 400 }
    );
  }

  const resolvedMode = mode === 'RESEARCH' ? 'RESEARCH' : 'STRICT';
  const normalizedContextSnapshot = normalizeContextSnapshot(
    body.contextSnapshot,
    activeHashes
  );

  if (chatSessionId) {
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
  }

  // -- 4. Resolve bearer token from verified Supabase session --
  const sessionResult = await supabase.auth.getSession();
  const accessToken = sessionResult.data.session?.access_token;

  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // -- 5. Proxy request ke Python streaming endpoint --
  const pyUrl = process.env.PY_URL;
  if (!pyUrl) {
    console.error('PY_URL environment variable is not configured.');
    return NextResponse.json(
      { error: 'Backend service URL not configured' },
      { status: 503 }
    );
  }

  let pyResponse: Response;
  try {
    pyResponse = await fetch(`${pyUrl}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: question.trim(),
        project_id: projectId,
        active_hashes: activeHashes,
        mode: resolvedMode,
      }),
      signal: AbortSignal.timeout(120000),
    });
  } catch (fetchError) {
    console.error('Failed to connect to Python backend:', fetchError);
    return NextResponse.json(
      { error: 'Failed to connect to AI backend service' },
      { status: 502 }
    );
  }

  if (!pyResponse.ok) {
    const errorText = await pyResponse.text().catch(() => 'Unknown error');
    console.error(`Python backend returned ${pyResponse.status}: ${errorText}`);
    return NextResponse.json(
      { error: `Backend error: ${pyResponse.status}` },
      { status: pyResponse.status }
    );
  }

  if (!pyResponse.body) {
    return NextResponse.json(
      { error: 'No streaming body received from backend' },
      { status: 502 }
    );
  }

  const reader = pyResponse.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let sseBuffer = '';
  let assistantText = '';
  let references: unknown[] = [];
  let metrics: Record<string, unknown> | undefined;
  let receivedFinalEvent = false;
  let pendingFinalEventBlock = '';
  let persistError: Error | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          sseBuffer += decoder.decode(value, { stream: true });

          const parts = sseBuffer.split(/\r?\n\r?\n/);
          sseBuffer = parts.pop() ?? '';

          for (const part of parts) {
            const { event, data } = parseSseEventBlock(part);
            if (!event || !data) {
              const rawText = part.trim();
              if (isIgnorableHeartbeatFrame(rawText)) {
                continue;
              }

              if (rawText) {
                assistantText += rawText;
                controller.enqueue(
                  encoder.encode(
                    `event: chunk\ndata: ${JSON.stringify({ text: rawText })}\n\n`
                  )
                );
              }
              continue;
            }

            if (event === 'chunk') {
              try {
                const payload = JSON.parse(data) as { text?: string };
                if (typeof payload.text === 'string') {
                  assistantText += payload.text;
                }
              } catch (error) {
                console.error('Failed to parse chunk event payload:', error);
              }

              controller.enqueue(encoder.encode(`${part}\n\n`));
              continue;
            }

            if (event === 'final') {
              try {
                const payload = JSON.parse(data) as FinalEventPayload;
                references = Array.isArray(payload.references)
                  ? payload.references
                  : [];
                metrics =
                  payload.metrics &&
                  typeof payload.metrics === 'object' &&
                  !Array.isArray(payload.metrics)
                    ? payload.metrics
                    : undefined;
                receivedFinalEvent = true;
              } catch (error) {
                console.error('Failed to parse final event payload:', error);
              }

              pendingFinalEventBlock = `${part}\n\n`;
              continue;
            }

            controller.enqueue(encoder.encode(`${part}\n\n`));
          }
        }

        sseBuffer += decoder.decode();

        if (sseBuffer.trim()) {
          const { event, data } = parseSseEventBlock(sseBuffer);
          if (event === 'final' && data) {
            try {
              const payload = JSON.parse(data) as FinalEventPayload;
              references = Array.isArray(payload.references)
                ? payload.references
                : references;
              metrics =
                payload.metrics &&
                typeof payload.metrics === 'object' &&
                !Array.isArray(payload.metrics)
                  ? payload.metrics
                  : metrics;
              receivedFinalEvent = true;
            } catch (error) {
              console.error('Failed to parse buffered final event:', error);
            }
            pendingFinalEventBlock = `${sseBuffer.trim()}\n\n`;
          } else {
            const rawText = sseBuffer.trim();
            if (!isIgnorableHeartbeatFrame(rawText)) {
              controller.enqueue(encoder.encode(`${rawText}\n\n`));
            }
          }
        }

        if (!receivedFinalEvent && assistantText.trim()) {
          receivedFinalEvent = true;
          pendingFinalEventBlock = `event: final\ndata: ${JSON.stringify({
            references: references ?? [],
            metrics: metrics ?? {},
          })}\n\n`;
        }

        if (chatSessionId && receivedFinalEvent) {
          try {
            await persistCompletedTurn({
              projectId,
              chatSessionId,
              userId: user.id,
              question: question.trim(),
              aiResponse: assistantText,
              references,
              mode: resolvedMode,
              activeHashes,
              contextSnapshot: normalizedContextSnapshot,
              metrics,
            });
          } catch (error) {
            persistError =
              error instanceof Error
                ? error
                : new Error('Unknown chat persistence error.');
            console.error('Failed to persist chat turn:', persistError);
          }
        }

        if (persistError && chatSessionId) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ message: persistError.message })}\n\n`
            )
          );
        } else if (pendingFinalEventBlock) {
          controller.enqueue(encoder.encode(pendingFinalEventBlock));
        }

        controller.close();
      } catch (error) {
        console.error('Error proxying chat stream:', error);
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Accel-Buffering': 'no',
      'Transfer-Encoding': 'chunked',
    },
  });
}

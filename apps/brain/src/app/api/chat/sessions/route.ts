import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@sre-monorepo/lib';
import { createServerSupabaseClient } from '@sre-monorepo/lib';

const SESSION_SELECT = {
  id: true,
  title: true,
  lastPreview: true,
  mode: true,
  contextSnapshot: true,
  createdAt: true,
  updatedAt: true,
  lastActivity: true,
} as const;

function normalizeMode(mode: unknown): string | null {
  if (mode === 'RESEARCH') {
    return 'RESEARCH';
  }

  if (mode === 'STRICT') {
    return 'STRICT';
  }

  return null;
}

function normalizeContextSnapshot(
  contextSnapshot: unknown
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (contextSnapshot === null || contextSnapshot === undefined) {
    return Prisma.JsonNull;
  }

  return JSON.parse(JSON.stringify(contextSnapshot)) as Prisma.InputJsonValue;
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

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
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

    const sessions = await prisma.chatSession.findMany({
      where: {
        projectId,
        userId: user.id,
      },
      orderBy: {
        lastActivity: 'desc',
      },
      select: SESSION_SELECT,
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!user || error) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: {
      projectId?: string;
      mode?: unknown;
      contextSnapshot?: unknown;
    };

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { projectId, mode, contextSnapshot } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
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

    const session = await prisma.chatSession.create({
      data: {
        projectId,
        userId: user.id,
        title: 'New Chat',
        mode: normalizeMode(mode),
        contextSnapshot: normalizeContextSnapshot(contextSnapshot),
        lastActivity: new Date(),
      },
      select: SESSION_SELECT,
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error('Error creating chat session:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

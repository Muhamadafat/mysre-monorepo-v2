/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sre-monorepo/lib';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        articles: true,
        chatMessages: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await prisma.project.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        coverColor: body.coverColor,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validasi: pastikan tidak ada artikel/chat terkait
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        articles: true,
        chatMessages: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    /*
    if (project.articles.length > 0 || project.chatMessages.length > 0) {
      return new NextResponse(
        JSON.stringify({
          error: 'Proyek tidak bisa dihapus karena memiliki artikel atau chat terkait.',
        }),
        { status: 400 }
      );
    }
    */

    await prisma.project.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}

// src/app/api/sessions/[id]/route.ts
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await req.json();

  try {
    const updateData: any = {
      selectedFilterArticles:
        body.selectedFilterArticles !== undefined
          ? body.selectedFilterArticles
          : undefined,
      graphFilters:
        body.graphFilters !== undefined ? body.graphFilters : undefined,
      lastSelectedNodeId:
        body.lastSelectedNodeId !== undefined
          ? body.lastSelectedNodeId
          : undefined,
      lastSelectedEdgeId:
        body.lastSelectedEdgeId !== undefined
          ? body.lastSelectedEdgeId
          : undefined,
    };

    // Update main fields via Prisma
    const updatedSession = await prisma.project.update({
      where: { id },
      data: {
        ...updateData,
        ...(body.comparativeTabs !== undefined
          ? { comparativeTabs: body.comparativeTabs }
          : {}),
      },
    });

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error('Error updating session filters:', error);
    return NextResponse.json(
      { error: 'Failed to update session filters' },
      { status: 500 }
    );
  }
}

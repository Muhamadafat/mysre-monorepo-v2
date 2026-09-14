/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sre-monorepo/lib';
import { createServerSupabaseClient } from '@sre-monorepo/lib';

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  // Perbaikan: Ambil id yang mungkin berupa writerSessionId atau projectId
  const body = await req.json();
  const projectIdParam = body.projectId;
  const writerSessionIdParam = body.writerSessionId;

  // Enhanced logging
  console.log('=== API /writer-sessions/create ===');
  console.log('Request payload:', body);
  console.log('Authenticated user:', user.id);

  if (!projectIdParam && !writerSessionIdParam) {
    return NextResponse.json(
      {
        message: 'Missing projectId or writerSessionId',
      },
      { status: 400 }
    );
  }

  try {
    // CASE 1: Jika ada projectIdParam (berarti dari brainstorming session/project)
    if (projectIdParam) {
      console.log('Case 1: Creating WriterSession from Project');
      
      // Ambil data Project berdasarkan projectIdParam
      const project = await prisma.project.findUnique({
        where: { id: projectIdParam },
      });

      if (!project) {
        console.log('❌ Project not found with id:', projectIdParam);
        return NextResponse.json(
          { message: 'Project not found' },
          { status: 404 }
        );
      }

      // Cek apakah user memiliki akses ke project ini
      if (project.userId !== user.id) {
        return NextResponse.json(
          { message: 'Access denied to this project' },
          { status: 403 }
        );
      }

      // Cek apakah WriterSession sudah ada untuk project ini
      const existing = await prisma.writerSession.findFirst({
        where: {
          projectId: projectIdParam,
          userId: user.id,
        },
      });

      if (existing) {
        console.log('✅ WriterSession already exists:', existing.id);
        return NextResponse.json({
          message: 'WriterSession already exists',
          id: existing.id,
          writerSession: existing,
          type: 'existing',
        });
      }

      // Buat WriterSession baru dengan relasi ke Project
      console.log('🆕 Creating new WriterSession...');
      const newWriterSession = await prisma.writerSession.create({
        data: {
          title: `Draft: ${project.title}`,
          description: project.description || '',
          userId: user.id,
          coverColor: project.coverColor,
          projectId: projectIdParam,
        },
      });

      console.log('✅ New WriterSession created:', newWriterSession.id);
      return NextResponse.json({
        id: newWriterSession.id,
        writerSession: newWriterSession,
        type: 'created',
      });
    }

    // CASE 2: Jika hanya ada writerSessionIdParam
    else {
      console.log('Case 2: Getting existing WriterSession');
      
      const writerSession = await prisma.writerSession.findUnique({
        where: { id: writerSessionIdParam },
        include: {
          project: true
        },
      });

      if (!writerSession) {
        console.log('❌ WriterSession not found with id:', writerSessionIdParam);
        return NextResponse.json(
          { message: 'WriterSession not found' },
          { status: 404 }
        );
      }

      // Cek apakah user memiliki akses ke writer session ini
      if (writerSession.userId !== user.id) {
        return NextResponse.json(
          { message: 'Access denied to this writer session' },
          { status: 403 }
        );
      }

      console.log('✅ Returning existing WriterSession:', writerSession.id);
      return NextResponse.json({
        id: writerSession.id,
        writerSession: writerSession,
        type: 'existing_writer',
      });
    }
  } catch (error: any) {
    console.error('❌ Error handling WriterSession:', error);
    return NextResponse.json(
      {
        message: 'Internal server error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

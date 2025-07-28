import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sre-monorepo/lib';
import { createServerSupabaseClient } from '@sre-monorepo/lib';

export async function POST(req: NextRequest) {
 

  console.log('🔍 Environment Check:');
  console.log('- SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('- PROJECT_REF:', process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF);
  console.log('- COOKIE_DOMAIN:', process.env.NEXT_PUBLIC_COOKIE_DOMAIN);

  console.log('🔍 Request Headers:');
  console.log('- Cookie header:', req.headers.get('cookie'));
  console.log('- User Agent:', req.headers.get('user-agent'));
  console.log('- Origin:', req.headers.get('origin'));

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  console.log('🔍 Supabase Auth Result:');
  console.log('- User:', user ? `${user.email} (${user.id})` : 'NULL');
  console.log('- Error:', error?.message || 'No error');

  if (!user) {
    return NextResponse.json({ 
      message: "Unauthorized",
      debug: {
        cookieHeader: req.headers.get('cookie'),
        hasProjectRef: !!process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF,
        projectRef: process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF,
        supabaseError: error?.message
      }
    }, { status: 401 });
  }

  const { sessionId, projectId } = await req.json(); // Terima kedua parameter

  if (!sessionId || !projectId) {
    return NextResponse.json({ 
      message: "Missing sessionId or projectId" 
    }, { status: 400 });
  }

  try {
    // Ambil data BrainstormingSession berdasarkan projectId
    const brainSession = await prisma.brainstormingSession.findUnique({
      where: { id: projectId }, // Gunakan projectId, bukan sessionId
    });

    if (!brainSession) {
      return NextResponse.json({ 
        message: "BrainstormingSession not found" 
      }, { status: 404 });
    }

    // Cek apakah WriterSession sudah ada untuk project ini
    const existing = await prisma.writerSession.findFirst({
      where: {
        brainstormingSessionId: projectId, // Relasi ke brainstorming session
        userId: user.id,
      },
    });

    if (existing) {
      return NextResponse.json({ 
        message: "WriterSession already exists", 
        id: existing.id,
        writerSession: existing
      });
    }

    // Buat WriterSession baru dengan relasi ke BrainstormingSession
    const newWriterSession = await prisma.writerSession.create({
      data: {
        title: `Draft: ${brainSession.title}`, // Prefix untuk membedakan
        description: brainSession.description || '',
        userId: user.id,
        coverColor: brainSession.coverColor,
        brainstormingSessionId: projectId, // Relasi ke brainstorming session
      },
    });

    return NextResponse.json({ 
      id: newWriterSession.id,
      writerSession: newWriterSession
    });
  } catch (error) {
    console.error('Error creating WriterSession:', error);
    return NextResponse.json({ 
      message: "Internal server error" 
    }, { status: 500 });
  }
}

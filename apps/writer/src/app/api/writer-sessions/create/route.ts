import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sre-monorepo/lib';
import { createServerSupabaseClient } from '@sre-monorepo/lib';

function extractUserIdFromSessionId(sessionId: string): string | null {
  try {
    // sessionId format: "userId_timestamp" 
    // Example: "f66de40d-ea0e-495c-b52d-dea1eff25cba_1753741"
    const parts = sessionId.split('_');
    if (parts.length >= 2 && parts[0].length > 20) { // UUID-like length check
      return parts[0];
    }
    return null;
  } catch (error) {
    console.error('Error extracting userId from sessionId:', error);
    return null;
  }
}

// Enhanced authentication function
async function authenticateUser(req: Request): Promise<{
  user: any | null;
  source: 'supabase' | 'sessionId' | 'none';
  error?: string;
}> {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');
  
  console.log('🔍 Auth attempt with sessionId:', sessionId);
  console.log('🔍 Full URL:', req.url);
  
  // Method 1: Try Supabase authentication first
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (user && !error) {
      console.log('✅ Supabase auth successful:', user.id);
      return { user, source: 'supabase' };
    }
    
    console.log('⚠️ Supabase auth failed:', error?.message || 'No user');
  } catch (supabaseError) {
    console.error('❌ Supabase auth error:', supabaseError);
  }
  
  // Method 2: Fallback to sessionId parameter
  if (sessionId) {
    console.log('🔄 Trying sessionId fallback authentication');
    
    const userId = extractUserIdFromSessionId(sessionId);
    if (userId) {
      try {
        // Verify user exists in database
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            name: true,
            group: true,
            nim: true,
          }
        });
        
        if (dbUser) {
          console.log('✅ SessionId auth successful:', userId);
          // Create user object similar to Supabase format
          const user = {
            id: dbUser.id,
            email: dbUser.email,
            user_metadata: {
              name: dbUser.name,
              group: dbUser.group,
              nim: dbUser.nim
            }
          };
          return { user, source: 'sessionId' };
        } else {
          console.log('❌ User not found for sessionId:', userId);
        }
      } catch (dbError) {
        console.error('❌ Database error during sessionId auth:', dbError);
      }
    } else {
      console.log('❌ Invalid sessionId format:', sessionId);
    }
  }
  
  return { user: null, source: 'none', error: 'Authentication failed' };
}

export async function POST(req: Request) {
  console.log('🔍 Writer session create API called');
  
  try {
    // Enhanced authentication
    const { user, source, error } = await authenticateUser(req);
    
    if (!user) {
      console.log('❌ Authentication failed:', error);
      return NextResponse.json(
        { 
          message: 'Unauthorized',
          error: error,
          hint: 'Try adding ?sessionId=your_session_id to the URL'
        }, 
        { status: 401 }
      );
    }
    
    console.log(`✅ Authenticated via ${source}:`, user.id);
    
    const body = await req.json();
    const { title, description, coverColor, sessionId, projectId } = body;

    // Jika ada projectId, cek brainstorming session
    let brainstormingSession = null;
    if (projectId) {
      brainstormingSession = await prisma.brainstormingSession.findUnique({
        where: { id: projectId },
      });
      
      if (!brainstormingSession) {
        return NextResponse.json({
          message: 'BrainstormingSession not found'
        }, { status: 404 });
      }
    }

    // Cek existing writer session
    const existingConditions: any = { userId: user.id };
    if (projectId) {
      existingConditions.brainstormingSessionId = projectId;
    }

    const existing = await prisma.writerSession.findFirst({
      where: existingConditions,
    });

    if (existing) {
      console.log('✅ WriterSession already exists:', existing.id);
      return NextResponse.json({ 
        message: "WriterSession already exists", 
        id: existing.id,
        writerSession: existing,
        authSource: source
      });
    }

    // Create new writer session
    const writerSessionData: any = {
      title: title || (brainstormingSession ? `Draft: ${brainstormingSession.title}` : 'New Draft'),
      description: description || brainstormingSession?.description || '',
      coverColor: coverColor || brainstormingSession?.coverColor || '#4c6ef5',
      userId: user.id,
      lastActivity: new Date(),
    };

    if (projectId) {
      writerSessionData.brainstormingSessionId = projectId;
    }

    const writerSession = await prisma.writerSession.create({
      data: writerSessionData,
    });

    console.log('✅ Writer session created:', writerSession.id);

    return NextResponse.json({ 
      id: writerSession.id,
      writerSession: writerSession,
      authSource: source // Debug info
    });
    
  } catch (error) {
    console.error('💥 Error in writer session create:', error);
    return NextResponse.json(
      { 
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
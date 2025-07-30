import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@sre-monorepo/lib";
import { createServerSupabaseClient } from "@sre-monorepo/lib";

function extractUserIdFromSessionId(sessionId: string): string | null {
  try {
    console.log('🔍 Extracting userId from sessionId:', sessionId);

    // Format 1: "userId_timestamp" (contoh: f66de40d-ea0e-495c-b52d-dea1eff25cba_1753...)
    if (sessionId.includes('_')) {
      const parts = sessionId.split('_');
      if (parts.length >= 2 && parts[0].length > 20) { // UUID-like length check
        console.log('🔍 Format 1 detected (with timestamp):', parts[0]);
        return parts[0];
      }
    }

    // Format 2: "userId" only (contoh: dc9e39de-0d8a-424d-8c3f-cc829f76ca7e)
    // Check if it looks like a UUID (36 characters with dashes)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(sessionId)) {
      console.log('🔍 Format 2 detected (UUID only):', sessionId);
      return sessionId;
    }

    console.log('❌ No valid format detected');
    return null;
  } catch (error) {
    console.error('❌ Error extracting userId from sessionId:', error);
    return null;
  }
}

async function authenticateUser(req: NextRequest): Promise<{
  user: any | null;
  source: 'supabase' | 'sessionId' | 'none';
  error?: string;
}> {
  const sessionId = req.nextUrl.searchParams.get('sessionId');

  console.log('🔍 Annotation auth attempt with sessionId:', sessionId);
  console.log('🔍 Full URL:', req.nextUrl.href);

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

// Helper function untuk mendapatkan user dari brainstorming session
async function getUserFromBrainstormingSession(brainstormingSessionId: string): Promise<any | null> {
  try {
    const session = await prisma.brainstormingSession.findUnique({
      where: { id: brainstormingSessionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            group: true,
            nim: true,
          }
        }
      }
    });

    if (session && session.user) {
      console.log('✅ Found user from brainstorming session:', session.user.id);
      return {
        id: session.user.id,
        email: session.user.email,
        user_metadata: {
          name: session.user.name,
          group: session.user.group,
          nim: session.user.nim
        }
      };
    }

    return null;
  } catch (error) {
    console.error('❌ Error getting user from brainstorming session:', error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const sessionId = searchParams.get("sessionId");
  
  // Coba authentication normal dulu
  let { user, source, error } = await authenticateUser(req);

  // Jika auth gagal dan sessionId ada, coba anggap sessionId sebagai brainstorming session ID
  if (!user && sessionId) {
    console.log('🔄 Trying to get user from brainstorming session ID:', sessionId);
    
    // Cek apakah sessionId adalah brainstorming session ID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(sessionId)) {
      user = await getUserFromBrainstormingSession(sessionId);
      if (user) {
        source = 'sessionId';
      }
    }
  }

  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const annotations = await prisma.annotation.findMany({
      where: {
        article: {
          sessionId: sessionId, // sessionId di sini adalah brainstorming session ID
        },
        userId: user.id, // Filter berdasarkan user yang berhasil di-authenticate
      },
      include: {
        article: {
          select: {
            id: true,
            title: true,
            filePath: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(annotations, { status: 200 });
  } catch (error) {
    console.error('Error fetching annotations:', error);
    return NextResponse.json({ error: 'Failed to fetch annotations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, source, error } = await authenticateUser(req);

  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const metadata = body?.metadata;
  const document = body?.document;

  if (!metadata || !document) {
    return NextResponse.json({ message: 'Missing document in metadata' });
  }

  try {
    const nodeWithUrl = await prisma.node.findFirst({
      where: { att_url: document },
      select: {
        id: true,
        title: true,
        att_url: true,
        article: {
          select: {
            id: true,
            title: true,
            filePath: true,
          },
        }
      }
    });

    if (!nodeWithUrl) {
      return NextResponse.json({
        message: `Article / Node not found for URL: ${document}`
      });
    }

    const article = nodeWithUrl.article;

    const newAnnotation = await prisma.annotation.create({
      data: {
        articleId: article.id,
        page: metadata.pageNumber,
        highlightedText: metadata.highlightedText || '',
        comment: metadata.contents || '',
        userId: user.id,
      },
      include: {
        article: {
          select: {
            id: true,
            title: true,
            filePath: true,
          }
        }
      }
    });

    return NextResponse.json(newAnnotation, { status: 200 });
  } catch (error) {
    console.error('[ANNOTATION_ERROR]', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

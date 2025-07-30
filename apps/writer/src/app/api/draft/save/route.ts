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
async function authenticateUser(req: NextRequest): Promise<{
  user: any | null;
  source: 'supabase' | 'sessionId' | 'none';
  error?: string;
}> {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  
  console.log('🔍 Draft save auth attempt with sessionId:', sessionId);
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

export async function POST(req: NextRequest) {
  console.log('🔍 Draft save API called');
  
  // 🔥 FIX: Use enhanced authentication instead of hardcoded Supabase
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
  
  console.log(`✅ Draft save authenticated via ${source}:`, user.id);

  try {
    const { 
      writerSessionId, 
      title, 
      contentBlocks, 
      wordCount 
    } = await req.json();

    if (!writerSessionId || !contentBlocks) {
      return NextResponse.json({ 
        message: "Missing required fields" 
      }, { status: 400 });
    }

    // Buat Draft baru (bukan upsert, karena setiap save adalah versi baru)
    const draft = await prisma.draft.create({
      data: {
        userId: user.id,
        writerId: writerSessionId,
        title: title || `Draft ${new Date().toISOString()}`,
      },
    });

    // Parse contentBlocks menjadi sections
    const sectionsData = [];
    let currentSection = { title: 'Content', content: [] as string[] };

    for (let i = 0; i < contentBlocks.length; i++) {
      const block = contentBlocks[i];
      
      if (block.type === 'heading') {
        // Jika ada section sebelumnya, save dulu
        if (currentSection.content.length > 0) {
          sectionsData.push({
            draftId: draft.id,
            title: currentSection.title,
            content: currentSection.content.join('\n'),
          });
        }
        
        // Mulai section baru dengan heading sebagai title
        const headingText = Array.isArray(block.content) 
          ? block.content.map((c: any) => c.text || '').join('').trim()
          : block.content?.toString() || `Section ${sectionsData.length + 1}`;
          
        currentSection = {
          title: headingText,
          content: []
        };
      } else {
        // Tambahkan content ke section saat ini
        let blockText = '';
        if (typeof block.content === 'string') {
          blockText = block.content;
        } else if (Array.isArray(block.content)) {
          blockText = block.content
            .map((item: any) => typeof item === 'string' ? item : item?.text || '')
            .join(' ');
        }
        
        if (blockText.trim()) {
          currentSection.content.push(blockText.trim());
        }
      }
    }

    // Jangan lupa section terakhir
    if (currentSection.content.length > 0) {
      sectionsData.push({
        draftId: draft.id,
        title: currentSection.title,
        content: currentSection.content.join('\n'),
      });
    }

    // Jika tidak ada sections, buat satu section default
    if (sectionsData.length === 0) {
      const allText = contentBlocks
        .map((block: any) => {
          if (typeof block.content === 'string') return block.content;
          if (Array.isArray(block.content)) {
            return block.content.map((c: any) => c.text || '').join(' ');
          }
          return '';
        })
        .join('\n')
        .trim();

      if (allText) {
        sectionsData.push({
          draftId: draft.id,
          title: title || 'Content',
          content: allText,
        });
      }
    }

    // Insert sections ke database
    if (sectionsData.length > 0) {
      await prisma.draftSection.createMany({
        data: sectionsData,
      });
    }

    // Return draft dengan sections
    const completeDraft = await prisma.draft.findUnique({
      where: { id: draft.id },
      include: {
        sections: true,
      }
    });

    console.log('✅ Draft saved successfully:', draft.id);

    return NextResponse.json({ 
      success: true,
      draft: completeDraft,
      wordCount,
      sectionsCount: sectionsData.length,
      authSource: source // Debug info
    });

  } catch (error) {
    console.error('💥 Error saving draft:', error);
    return NextResponse.json({ 
      message: "Internal server error",
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

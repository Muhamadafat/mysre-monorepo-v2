import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@sre-monorepo/lib"
import { prisma } from "@sre-monorepo/lib"

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

// Enhanced authentication function (sama seperti sebelumnya)
async function authenticateUser(req: NextRequest): Promise<{
  user: any | null;
  source: 'supabase' | 'sessionId' | 'none';
  error?: string;
}> {
  const url = new URL(req.url);
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  const requestedUserId = req.nextUrl.searchParams.get('userId'); // Support untuk query specific user
  
  console.log('🔍 Profile auth attempt with sessionId:', sessionId);
  console.log('🔍 Requested userId:', requestedUserId);
  
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
  
  // Method 3: Direct userId query (untuk admin atau cross-user access)
  if (requestedUserId) {
    console.log('🔄 Trying direct userId query');
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: requestedUserId },
        select: {
          id: true,
          email: true,
          name: true,
          group: true,
          nim: true,
        }
      });
      
      if (dbUser) {
        console.log('✅ Direct userId auth successful:', requestedUserId);
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
      }
    } catch (dbError) {
      console.error('❌ Database error during direct userId query:', dbError);
    }
  }
  
  return { user: null, source: 'none', error: 'Authentication failed' };
}

export async function GET(request: NextRequest) {
  try {
    console.log("=== API PROFILE START ===")
    console.log("🔍 Request URL:", request.url)

    // Enhanced authentication dengan fallback
    const { user, source, error } = await authenticateUser(request);
    
    if (!user) {
      console.log("❌ Authentication failed:", error)
      return NextResponse.json({ 
        error: "Not authenticated",
        hint: "Try adding ?sessionId=your_session_id or ?userId=your_user_id to the URL",
        authSource: source
      }, { status: 401 })
    }

    console.log(`✅ Authenticated via ${source}:`, user.id)

    // Parse query parameters untuk determine target user
    const url = new URL(request.url);
    const requestedUserId = url.searchParams.get('userId');
    const sessionId = url.searchParams.get('sessionId');
    
    // Determine target user ID
    let targetUserId = user.id;
    
    // Jika ada requestedUserId, gunakan itu (untuk admin access)
    if (requestedUserId) {
      targetUserId = requestedUserId;
    }
    // Jika auth via sessionId, extract userId dari sessionId
    else if (sessionId && source === 'sessionId') {
      const extractedUserId = extractUserIdFromSessionId(sessionId);
      if (extractedUserId) {
        targetUserId = extractedUserId;
      }
    }

    console.log("Looking for user ID:", targetUserId)

    // Ambil dari database
    const dbUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        name: true,
        group: true,
        nim: true,
      },
    })

    console.log("Database user found:", !!dbUser)
    console.log("Database user data:", dbUser)

    if (dbUser) {
      const result = {
        user: {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          group: dbUser.group,
          nim: dbUser.nim,
        },
        authSource: source, // Debug info
        targetUserId: targetUserId, // Debug info
      }

      console.log("✅ Returning user data:", result)
      console.log("=== API PROFILE END ===")

      return NextResponse.json(result)
    }

    // Jika tidak ada di database
    console.log("❌ User not found in database for ID:", targetUserId)
    return NextResponse.json({ 
      error: "User not found in database",
      targetUserId: targetUserId,
      authSource: source
    }, { status: 404 })
    
  } catch (error) {
    console.error("💥 API Profile error:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Optional: POST method untuk update profile
export async function POST(request: NextRequest) {
  try {
    console.log("=== API PROFILE UPDATE START ===")

    const { user, source, error } = await authenticateUser(request);
    
    if (!user) {
      console.log("❌ Authentication failed:", error)
      return NextResponse.json({ 
        error: "Not authenticated" 
      }, { status: 401 })
    }

    const body = await request.json();
    const { name, group, nim } = body;

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(name && { name }),
        ...(group && { group }),
        ...(nim && { nim }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        group: true,
        nim: true,
      }
    });

    console.log("✅ User profile updated:", updatedUser.id)

    return NextResponse.json({
      user: updatedUser,
      authSource: source
    });

  } catch (error) {
    console.error("💥 API Profile update error:", error)
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 })
  }
}

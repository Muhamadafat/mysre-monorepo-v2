import { type NextRequest, NextResponse } from "next/server"
import { getServerSession, signOutUser } from "@sre-monorepo/lib/server"
import { sendXapiStatementServer } from "@sre-monorepo/lib/server"
import { prisma } from "@sre-monorepo/lib/server"

export async function POST(request: NextRequest) {
  try {
    //tambahxapi
    const session = await getServerSession();

    if (session){
      const sessionId = `${session.user.id}_${Math.floor(session.expires_at! / 1000)}`
      const subdomain = request.headers.get('host')?.includes('profile') ? 'profile' : 'brain'
      
      // Calculate session duration jika ada session start
      // const sessionStartTime = request.headers.get('X-Session-Start-Time')
      const sessionDuration = await calculateSessionDuration(session.user.id, sessionId);

      await sendXapiStatementServer({
        verb: {
          id: "http://adlnet.gov/expapi/verbs/logged-out",
          display: { "en-US": "logged out" }
        },
        object: {
          id: `${subdomain}/logout`,
          definition: {
            name: { "en-US": `Logout from ${subdomain}` },
            type: "http://adlnet.gov/expapi/activities/interaction"
          }
        },
        result: {
          duration: sessionDuration,
          completion: true,
          success: true
        },
        context: {
          extensions: {
            sessionId: sessionId,
            flowStep: "session-end",
            logoutSource: subdomain,
            userAgent: request.headers.get('user-agent') || '',
          }
        }
      }, session, subdomain)
    }
    
    await signOutUser()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Sign out error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function calculateSessionDuration(userId: string, currentSessionId: string): Promise<string> {
  try {
    console.log(`🕐 Finding session start for ${currentSessionId}`);
    
    // Find ANY statement with this sessionId (earliest = session start)
    const sessionStart = await prisma.xapiStatement.findFirst({
      where: {
        userId: userId,
        context: {
          path: ['extensions', 'sessionId'],
          equals: currentSessionId
        }
      },
      orderBy: {
        timestamp: 'asc' // Earliest first
      }
    });
    
    if (sessionStart) {
      const duration = Date.now() - sessionStart.timestamp.getTime();
      const durationSeconds = (duration / 1000).toFixed(1);
      
      console.log(`✅ Session started at: ${sessionStart.timestamp.toISOString()}`);
      console.log(`✅ Duration: ${durationSeconds}s`);
      
      return `PT${durationSeconds}S`;
    }
    
    console.warn(`⚠️ No session data found for ${currentSessionId}`);
    return "PT60S"; // Default 1 minute if no data
    
  } catch (error) {
    console.error("❌ Error calculating duration:", error);
    return "PT0S";
  }
}
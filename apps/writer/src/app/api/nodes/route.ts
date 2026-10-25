import { NextRequest, NextResponse } from "next/server";
import { prisma, getServerSession } from "@sre-monorepo/lib/server";
import { canAccessWriterSession } from "@/lib/writerSessionAccess";

/**
 * Concept-map nodes (the project's "Referensi Pustaka", also the AI
 * writer's grounding context) for a writer project.
 *
 * `projectId` is either a WriterSession id or a BrainstormingSession id.
 * Nodes always come from the PROJECT OWNER's articles, and access is
 * granted to the owner AND to invited collaborators — previously every
 * lookup was filtered by the requesting user's id, so a collaborator got an
 * empty list (no references, and the AI refused to write for lack of
 * context). The user is taken from the server-side session; the old
 * client-supplied `sessionId` (user id) query param is ignored, since
 * trusting it let anyone read anyone's nodes by editing the URL.
 */
export async function GET(req: NextRequest) {
  try {
    const authSession = await getServerSession();
    const user = authSession?.user;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = new URL(req.url).searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    let ownerId: string | null = null;
    let brainstormingSessionId: string | null = null;

    const writerSession = await prisma.writerSession.findUnique({
      where: { id: projectId },
      select: { id: true, userId: true, brainstormingSessionId: true },
    });

    if (writerSession) {
      if (!(await canAccessWriterSession(writerSession.id, user.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      ownerId = writerSession.userId;
      brainstormingSessionId = writerSession.brainstormingSessionId;
    } else {
      const brainstormingSession = await prisma.brainstormingSession.findUnique({
        where: { id: projectId },
        select: { id: true, userId: true },
      });
      if (!brainstormingSession) {
        return NextResponse.json([]);
      }
      // The owner, or a collaborator on one of the owner's writer sessions
      // built from this brainstorming session.
      const allowed =
        brainstormingSession.userId === user.id ||
        (await prisma.writerSession.count({
          where: {
            brainstormingSessionId: brainstormingSession.id,
            collaborators: { some: { userId: user.id } },
          },
        })) > 0;
      if (!allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      ownerId = brainstormingSession.userId;
      brainstormingSessionId = brainstormingSession.id;
    }

    if (!brainstormingSessionId || !ownerId) {
      return NextResponse.json([]);
    }

    const nodes = await prisma.node.findMany({
      where: {
        article: {
          userId: ownerId,
          sessionId: brainstormingSessionId, // Article.sessionId = brainstormingSessionId
        },
      },
      include: {
        article: {
          select: {
            id: true,
            title: true,
            userId: true,
            sessionId: true,
            session: { select: { id: true, title: true } },
          },
        },
      },
    });

    return NextResponse.json(nodes);
  } catch (error: any) {
    console.error("Error fetching nodes: ", error);
    return NextResponse.json(
      { error: "Failed to fetch nodes", details: error.message },
      { status: 500 }
    );
  }
}

import { prisma } from '@sre-monorepo/lib/server';

/** Owner OR an added collaborator can read/edit a writer session's draft. */
export async function canAccessWriterSession(writerSessionId: string, userId: string): Promise<boolean> {
  const session = await prisma.writerSession.findUnique({
    where: { id: writerSessionId },
    select: {
      userId: true,
      collaborators: { where: { userId }, select: { id: true } },
    },
  });
  if (!session) return false;
  return session.userId === userId || session.collaborators.length > 0;
}

/** Only the owner can manage collaborators (add/remove). */
export async function isWriterSessionOwner(writerSessionId: string, userId: string): Promise<boolean> {
  const session = await prisma.writerSession.findUnique({
    where: { id: writerSessionId },
    select: { userId: true },
  });
  return !!session && session.userId === userId;
}

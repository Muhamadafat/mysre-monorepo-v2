import { redirect } from 'next/navigation';
import { prisma } from '@sre-monorepo/lib/server';
import { getServerSession } from '@sre-monorepo/lib/server';

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const session = await getServerSession();
  const user = session?.user;

  // The writer app's middleware already requires auth for every non-API route,
  // so this is a defensive fallback rather than the primary gate.
  if (!user) {
    const mainAppUrl = process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://main.lvh.me:3000';
    const redirectUrl = new URL('/signin', mainAppUrl);
    redirectUrl.searchParams.set('redirectedFrom', `/invite/${token}`);
    redirect(redirectUrl.toString());
  }

  const writerSession = await prisma.writerSession.findUnique({
    where: { shareToken: token },
    select: { id: true, userId: true },
  });

  if (!writerSession) {
    redirect('/?inviteError=invalid');
  }

  if (writerSession.userId !== user.id) {
    await prisma.writerSessionCollaborator.upsert({
      where: { writerSessionId_userId: { writerSessionId: writerSession.id, userId: user.id } },
      update: {},
      create: { writerSessionId: writerSession.id, userId: user.id, role: 'editor' },
    });
  }

  redirect(`/project/${writerSession.id}/draft`);
}

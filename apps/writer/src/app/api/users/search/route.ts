import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sre-monorepo/lib/server';
import { getServerSession } from '@sre-monorepo/lib/server';

// Search existing platform users by name/email, for the "add collaborator"
// picker. Returns only non-sensitive fields, excludes the current user.
export async function GET(req: NextRequest) {
  const session = await getServerSession();
  const user = session?.user;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() || '';
  if (q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const users = await prisma.user.findMany({
    where: {
      id: { not: user.id },
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, email: true },
    take: 10,
  });

  return NextResponse.json({ users });
}

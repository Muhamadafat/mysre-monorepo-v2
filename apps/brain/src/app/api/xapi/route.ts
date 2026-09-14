import { NextResponse } from 'next/server';
import { prisma } from '@sre-monorepo/lib';

/**
 * POST /api/xapi
 *
 * Mencatat statemen xAPI dari frontend.
 * Dioptimalkan menjadi Non-blocking (Fire & Forget) untuk mengurangi latensi UI.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validasi dasar
    if (!body.actor || !body.verb || !body.object) {
      return NextResponse.json(
        { error: 'Invalid xAPI statement' },
        { status: 400 }
      );
    }

    const userId = body.userId || null;
    const projectId = body.context?.extensions?.projectId || null;

    // EXECUTION STRATEGY: Fire & Forget
    // Kita tidak menggunakan 'await' pada operasi database agar response bisa dikirim seketika.
    // Seluruh logika database dipindahkan ke background promise.

    Promise.resolve().then(async () => {
      try {
        // 1. Tentukan sequence secara asinkron di background
        let sequence = 1;
        if (projectId && userId) {
          const lastStatement = await prisma.xapiStatement.findFirst({
            where: { userId, projectId },
            orderBy: { sequence: 'desc' },
          });
          sequence = (lastStatement?.sequence || 0) + 1;
        }

        // 2. Simpan statemen
        await prisma.xapiStatement.create({
          data: {
            actor: body.actor,
            verb: body.verb,
            object: body.object,
            result: body.result || null,
            context: body.context || null,
            userId: userId,
            projectId: projectId,
            sequence: sequence,
          },
        });
      } catch (dbError) {
        // Karena berjalan di background, kita hanya bisa mencatat error ke log server
        console.error('Async DB Error recording xAPI statement:', dbError);
      }
    });

    // Berikan response langsung (< 100ms)
    return NextResponse.json(
      { message: 'Statement dispatched to background worker' },
      { status: 202 }
    );
  } catch (error) {
    console.error('Critical error in xAPI route:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

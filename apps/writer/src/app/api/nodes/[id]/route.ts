import { prisma } from '@sre-monorepo/lib';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  const { id: idParam } = await params;

  const id = Number(idParam);

  return NextResponse.json(
    { msg: 'Delete Node Succed', id: id },
    { status: 201 }
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Node model is deleted, return error or empty
    return NextResponse.json({ error: 'Nodes are handled by Neo4j' }, { status: 404 });
  } catch (error) {
    console.error('Error', error);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

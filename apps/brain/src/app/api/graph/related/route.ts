import { NextResponse } from "next/server";
import { getRelatedNodes } from "@sre-monorepo/lib/server";

// Nodes within N hops of a given node, across the whole graph (not just one article) —
// backed by ArcadeDB's TRAVERSE, which Postgres/Prisma can't do without a recursive CTE.
export async function POST(request: Request) {
  try {
    const { node_id, depth = 2 } = await request.json();

    if (!node_id) {
      return NextResponse.json({ error: "Missing node_id" }, { status: 400 });
    }

    const clampedDepth = Math.min(Math.max(Number(depth) || 2, 1), 5);
    const nodes = await getRelatedNodes(node_id, clampedDepth);

    return NextResponse.json({ node_id, depth: clampedDepth, related: nodes });
  } catch (error) {
    console.error("Graph related error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

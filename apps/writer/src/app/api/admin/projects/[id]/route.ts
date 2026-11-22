import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { readLiveDocument } from "@/lib/admin/data";
import { authoredPassages, computeContributions } from "@/lib/contributions";

/**
 * GET /api/admin/projects/<writerSessionId>/ — the live document as the
 * students see it now (read from PartyKit, read-only). `live: null` when the
 * collaboration server is off; the page then offers the saved versions.
 * Also: per-collaborator word counts + passages (same counting as the
 * editor's "Kontribusi" menu) and the comment threads ("Komentar").
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Login halaman penelitian dulu." }, { status: 401 });
  const id = (await params).id;
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(id)) return NextResponse.json({ error: "Id tidak valid." }, { status: 400 });
  const doc = await readLiveDocument(id);
  return NextResponse.json({
    projectId: id,
    live: doc?.nodes ?? null,
    contributorNames: doc?.contributorNames ?? {},
    contributions: doc ? computeContributions(doc.nodes) : {},
    passages: doc ? authoredPassages(doc.nodes) : [],
    comments: doc?.comments ?? null,
    readAt: new Date().toISOString(),
  });
}

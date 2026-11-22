import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { readSavedDraft } from "@/lib/admin/data";

/** GET /api/admin/drafts/<draftId> — one saved version (blocks + its Daftar Pustaka). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Login halaman penelitian dulu." }, { status: 401 });
  const draft = await readSavedDraft((await params).id).catch(() => null);
  if (!draft) return NextResponse.json({ error: "Versi tidak ditemukan." }, { status: 404 });
  return NextResponse.json(draft);
}

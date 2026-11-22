import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { studentPortfolio } from "@/lib/admin/data";

/** GET /api/admin/students/<userId> — projects, versions, references, citations, recordings. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Login halaman penelitian dulu." }, { status: 401 });
  try {
    const portfolio = await studentPortfolio((await params).id);
    if (!portfolio) return NextResponse.json({ error: "Mahasiswa tidak ditemukan." }, { status: 404 });
    return NextResponse.json(portfolio);
  } catch (err) {
    console.error("[admin/students/id]", err);
    return NextResponse.json({ error: "Gagal membaca portofolio." }, { status: 500 });
  }
}

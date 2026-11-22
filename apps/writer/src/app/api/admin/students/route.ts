import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { listStudents } from "@/lib/admin/data";

/** GET /api/admin/students — every writer with counts (read-only). */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Login halaman penelitian dulu." }, { status: 401 });
  try {
    const students = await listStudents();
    return NextResponse.json({ count: students.length, students });
  } catch (err) {
    console.error("[admin/students]", err);
    return NextResponse.json({ error: "Gagal membaca daftar mahasiswa." }, { status: 500 });
  }
}

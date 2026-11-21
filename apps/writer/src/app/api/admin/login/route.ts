import { NextResponse } from "next/server";
import { checkAdminLogin, setAdminCookie } from "@/lib/adminAuth";

/** POST /api/admin/login { username, password } — hard-coded admin account (ADMIN_USERNAME / ADMIN_PASSWORD). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!checkAdminLogin(String(body.username ?? ""), String(body.password ?? ""))) {
    // Small delay so the password can't be brute-forced quickly.
    await new Promise((resolve) => setTimeout(resolve, 600));
    return NextResponse.json({ error: "Username atau password salah." }, { status: 401 });
  }
  await setAdminCookie();
  return NextResponse.json({ ok: true });
}

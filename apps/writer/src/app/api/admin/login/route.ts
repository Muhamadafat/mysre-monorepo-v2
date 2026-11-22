import { NextResponse } from "next/server";
import { adminLoginProblem, checkAdminLogin, setAdminCookie } from "@/lib/adminAuth";
import { createLoginThrottle } from "@/lib/loginThrottle";

// 5 wrong attempts per 15 minutes per client, then locked until the window passes.
const throttle = createLoginThrottle({ maxFailures: 5, windowMs: 15 * 60 * 1000 });

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

/** POST /api/admin/login { username, password } — the single penelitian account (ADMIN_USERNAME / ADMIN_PASSWORD). */
export async function POST(request: Request) {
  const problem = adminLoginProblem();
  if (problem) {
    console.error(`[penelitian] login dimatikan: ${problem}`);
    return NextResponse.json({ error: "Login penelitian belum diatur di server. Hubungi pengelola." }, { status: 503 });
  }

  const key = clientKey(request);
  const wait = throttle.retryAfter(key);
  if (wait > 0) {
    return NextResponse.json(
      { error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${Math.ceil(wait / 60)} menit.` },
      { status: 429, headers: { "Retry-After": String(wait) } },
    );
  }

  const body = await request.json().catch(() => ({}));
  if (!checkAdminLogin(String(body.username ?? ""), String(body.password ?? ""))) {
    throttle.fail(key);
    // Small delay so the password can't be brute-forced quickly.
    await new Promise((resolve) => setTimeout(resolve, 600));
    return NextResponse.json({ error: "Username atau password salah." }, { status: 401 });
  }
  throttle.succeed(key);
  await setAdminCookie();
  return NextResponse.json({ ok: true });
}

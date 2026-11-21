import { NextResponse } from "next/server";
import { getServerSession } from "@sre-monorepo/lib/server";

/**
 * GET /api/references/pdf?url=<brain upload URL> — streams a reference PDF
 * from brain through the writer's own origin, so the PDF viewer can load it
 * (brain's /uploads has no CORS header). Only brain's /uploads/*.pdf is
 * allowed, so this can't be used to fetch arbitrary URLs.
 */
export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = new URL(request.url).searchParams.get("url") ?? "";
  const brainBase = process.env.NEXT_PUBLIC_BRAIN_APP_URL || "";
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "URL tidak valid." }, { status: 400 });
  }
  const allowedOrigins = new Set([brainBase, process.env.BRAIN_INTERNAL_URL || ""].filter(Boolean).map((u) => new URL(u).origin));
  if (!allowedOrigins.has(target.origin) || !target.pathname.startsWith("/uploads/") || !/\.pdf$/i.test(target.pathname)) {
    return NextResponse.json({ error: "Hanya PDF referensi dari brain yang bisa dibuka." }, { status: 400 });
  }

  const internal = process.env.BRAIN_INTERNAL_URL ? new URL(target.pathname, process.env.BRAIN_INTERNAL_URL) : target;
  let upstream: Response;
  try {
    upstream = await fetch(internal, {
      headers: request.headers.get("range") ? { range: request.headers.get("range")! } : {},
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Aplikasi brain tidak bisa dihubungi, jadi PDF belum bisa dibuka." }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: upstream.status === 404 ? "File PDF tidak ditemukan." : `Gagal membuka PDF (${upstream.status}).` }, { status: upstream.status === 404 ? 404 : 502 });
  }

  const headers = new Headers({ "Content-Type": "application/pdf", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" });
  for (const name of ["content-length", "content-range", "accept-ranges"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

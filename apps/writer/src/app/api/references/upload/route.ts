import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma, getServerSession, upsertGraphNode } from "@sre-monorepo/lib/server";
import { canAccessWriterSession } from "@/lib/writerSessionAccess";

/**
 * POST /api/references/upload (multipart: file, projectId, title?, author?,
 * year?, doi?, abstract?, keywords?) — the "+" on "Referensi Pustaka".
 *
 * Hands the PDF to brain's own POST /api/upload (same as uploading in
 * brain): brain stores the file, the AI turns it into a concept-map node and
 * links it to the other articles of the brainstorming session. That session
 * is the project's reference library; a project without one gets one
 * created (owned by the project owner) and linked, so the upload has
 * somewhere to go. Needs brain (NEXT_PUBLIC_BRAIN_APP_URL) and, for the AI
 * part, mcp-sre (PY_URL) running.
 *
 * Without a file (details only, e.g. imported from a .ris export that has no
 * PDF), the reference is saved straight away as an Article + its "article"
 * node — no AI analysis, so it can still be cited with its real author/year.
 */

export const maxDuration = 300;

const MAX_PDF_BYTES = 30 * 1024 * 1024;
const FORWARDED_FIELDS = ["title", "author", "year", "doi", "abstract", "keywords"] as const;

/** Resolves the brainstorming session a project's references live in, creating one if missing. */
async function referenceSessionFor(projectId: string, userId: string) {
  const writer = await prisma.writerSession.findUnique({
    where: { id: projectId },
    select: { id: true, title: true, userId: true, brainstormingSessionId: true },
  });
  if (writer) {
    if (!(await canAccessWriterSession(writer.id, userId))) return { error: "Forbidden", status: 403 } as const;
    if (writer.brainstormingSessionId) return { sessionId: writer.brainstormingSessionId } as const;
    const created = await prisma.brainstormingSession.create({
      data: { title: writer.title || "Referensi", description: "Dibuat dari unggahan referensi di writer", userId: writer.userId },
      select: { id: true },
    });
    await prisma.writerSession.update({ where: { id: writer.id }, data: { brainstormingSessionId: created.id } });
    return { sessionId: created.id } as const;
  }

  // projectId may also be the BrainstormingSession id (arriving from brain).
  const brainstorm = await prisma.brainstormingSession.findUnique({ where: { id: projectId }, select: { id: true, userId: true } });
  if (!brainstorm) return { error: "Proyek tidak ditemukan.", status: 404 } as const;
  const allowed =
    brainstorm.userId === userId ||
    (await prisma.writerSession.count({ where: { brainstormingSessionId: brainstorm.id, collaborators: { some: { userId } } } })) > 0;
  if (!allowed) return { error: "Forbidden", status: 403 } as const;
  return { sessionId: brainstorm.id } as const;
}

export async function POST(request: Request) {
  const session = await getServerSession();
  const user = session?.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Kirim sebagai multipart/form-data dengan field 'file'." }, { status: 400 });
  }
  const file = form.get("file");
  const projectId = String(form.get("projectId") ?? "");
  if (!projectId) return NextResponse.json({ error: "projectId kosong." }, { status: 400 });
  if (!(file instanceof File) || !file.size) return saveWithoutPdf(form, projectId, String(user.id));
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Hanya file PDF yang bisa diunggah." }, { status: 415 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: `File terlalu besar (maks ${MAX_PDF_BYTES / 1024 / 1024} MB).` }, { status: 413 });
  }

  const target = await referenceSessionFor(projectId, String(user.id));
  if ("error" in target) return NextResponse.json({ error: target.error }, { status: target.status });

  const brainUrl = (process.env.BRAIN_INTERNAL_URL || process.env.NEXT_PUBLIC_BRAIN_APP_URL || "").replace(/\/$/, "");
  if (!brainUrl) return NextResponse.json({ error: "Alamat aplikasi brain (NEXT_PUBLIC_BRAIN_APP_URL) belum diatur." }, { status: 500 });

  const out = new FormData();
  out.append("file", file, file.name);
  out.append("title", String(form.get("title") || "") || file.name);
  out.append("sessionId", target.sessionId);
  out.append("uploadId", `writer_${randomUUID()}`);
  for (const field of FORWARDED_FIELDS) {
    if (field === "title") continue;
    const value = form.get(field);
    if (typeof value === "string" && value.trim()) out.append(field, value.trim());
  }

  let res: Response;
  try {
    // Brain authenticates with the same login cookie, so forward it as-is.
    res = await fetch(`${brainUrl}/api/upload`, {
      method: "POST",
      body: out,
      headers: { cookie: request.headers.get("cookie") ?? "" },
    });
  } catch (err) {
    console.error("[references/upload] brain unreachable:", err);
    return NextResponse.json(
      { error: "Aplikasi brain tidak bisa dihubungi. Jalankan brain (npm run dev --workspace apps/brain) lalu coba lagi." },
      { status: 502 }
    );
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: body.error || body.message || `Brain menolak unggahan (${res.status}).` }, { status: res.status === 401 ? 401 : 502 });
  }
  return NextResponse.json({
    sessionId: target.sessionId,
    article: body.article ? { id: body.article.id, title: body.article.title } : null,
    nodeCreated: Boolean(body.parentNode),
    edges: Array.isArray(body.edges) ? body.edges.length : 0,
    warning: body.degraded ? "Artikel tersimpan, tapi analisis AI sedang tidak tersedia jadi belum muncul di daftar referensi." : null,
  });
}


/** Text field from the form, trimmed and capped. */
function field(form: FormData, name: string, max: number): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** A reference with details only (no PDF): Article + one "article" node. */
async function saveWithoutPdf(form: FormData, projectId: string, userId: string) {
  const title = field(form, "title", 500);
  if (!title) {
    return NextResponse.json({ error: "Pilih file PDF, atau isi minimal judulnya (bisa dari Impor RIS)." }, { status: 400 });
  }
  const target = await referenceSessionFor(projectId, userId);
  if ("error" in target) return NextResponse.json({ error: target.error }, { status: target.status });

  const doi = field(form, "doi", 200).replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  const url = field(form, "url", 1000);
  const abstract = field(form, "abstract", 20000);
  const link = /^https?:\/\//i.test(url) ? url : doi ? `https://doi.org/${doi}` : "";

  const article = await prisma.article.create({
    data: {
      title,
      filePath: link,
      userId,
      sessionId: target.sessionId,
      author: field(form, "author", 1000) || null,
      year: field(form, "year", 20) || null,
      doi: doi || null,
      abstract: abstract || null,
      keywords: field(form, "keywords", 1000) || null,
    },
  });
  const node = await prisma.node.create({
    data: {
      label: title.length > 80 ? `${title.slice(0, 77)}...` : title,
      title,
      type: "article",
      content: abstract || title,
      att_background: abstract || null,
      att_url: link || null,
      articleId: article.id,
    },
  });
  await upsertGraphNode(node); // ArcadeDB mirror; never throws

  return NextResponse.json({
    sessionId: target.sessionId,
    article: { id: article.id, title: article.title },
    nodeCreated: true,
    edges: 0,
    withoutPdf: true,
    warning: null,
  });
}

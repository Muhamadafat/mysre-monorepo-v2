import { NextResponse } from "next/server";
import { prisma, getServerSession, upsertGraphNode, deleteGraphForArticle } from "@sre-monorepo/lib/server";

/**
 * PATCH  /api/references/:articleId (JSON: title, author, year, doi, abstract, keywords)
 *        — "Edit" on a Referensi Pustaka card: fixes the article's details
 *        and the title of its "article" node.
 * DELETE /api/references/:articleId — "Hapus": removes the article, its
 *        nodes/edges (cascade + ArcadeDB mirror) and its annotations.
 *
 * Allowed for whoever can see the project's references: the owner of the
 * brainstorming session, or the owner/collaborator of a writer project
 * built on it (same rule as /api/nodes and /api/references/upload).
 */

type Params = { params: Promise<{ articleId: string }> };

async function loadAllowedArticle(articleId: string, userId: string) {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { id: true, sessionId: true, filePath: true, session: { select: { userId: true } } },
  });
  if (!article || !article.sessionId) return { error: "Referensi tidak ditemukan.", status: 404 } as const;
  const allowed =
    article.session?.userId === userId ||
    (await prisma.writerSession.count({
      where: {
        brainstormingSessionId: article.sessionId,
        OR: [{ userId }, { collaborators: { some: { userId } } }],
      },
    })) > 0;
  if (!allowed) return { error: "Forbidden", status: 403 } as const;
  return { article } as const;
}

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export async function PATCH(request: Request, { params }: Params) {
  const user = (await getServerSession())?.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { articleId } = await params;

  const found = await loadAllowedArticle(articleId, String(user.id));
  if ("error" in found) return NextResponse.json({ error: found.error }, { status: found.status });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  const title = text(body.title, 500);
  if (!title) return NextResponse.json({ error: "Judul tidak boleh kosong." }, { status: 400 });
  const doi = text(body.doi, 200).replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  const abstract = text(body.abstract, 20000);

  const hasPdf = /\.pdf($|\?)/i.test(found.article.filePath);
  // A PDF-less reference links to its DOI; keep that link in step with the DOI.
  const oldLinkIsDoi = !found.article.filePath || /^https?:\/\/doi\.org\//i.test(found.article.filePath);
  const link = !hasPdf && oldLinkIsDoi ? (doi ? `https://doi.org/${doi}` : "") : found.article.filePath;

  const article = await prisma.article.update({
    where: { id: articleId },
    data: {
      title,
      author: text(body.author, 1000) || null,
      year: text(body.year, 20) || null,
      doi: doi || null,
      abstract: abstract || null,
      keywords: text(body.keywords, 1000) || null,
      filePath: link,
    },
    select: { id: true, title: true, author: true, year: true, doi: true, abstract: true, keywords: true, filePath: true },
  });

  // The article's own node carries the title shown in the list. Without a PDF
  // its background/content IS the abstract; with a PDF those come from the AI
  // analysis and are left alone.
  const nodes = await prisma.node.findMany({ where: { articleId, type: "article" } });
  for (const node of nodes) {
    const updated = await prisma.node.update({
      where: { id: node.id },
      data: {
        title,
        label: title.length > 80 ? `${title.slice(0, 77)}...` : title,
        ...(hasPdf ? {} : { att_background: abstract || null, content: abstract || title, att_url: link || null }),
      },
    });
    await upsertGraphNode(updated); // ArcadeDB mirror; never throws
  }

  return NextResponse.json({ article });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = (await getServerSession())?.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { articleId } = await params;

  const found = await loadAllowedArticle(articleId, String(user.id));
  if ("error" in found) return NextResponse.json({ error: found.error }, { status: found.status });

  // Annotations don't cascade, so they go first; nodes/edges cascade.
  await prisma.$transaction([
    prisma.annotation.deleteMany({ where: { articleId } }),
    prisma.article.delete({ where: { id: articleId } }),
  ]);
  await deleteGraphForArticle(articleId);

  return NextResponse.json({ deletedArticleId: articleId });
}

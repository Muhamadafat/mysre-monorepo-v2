/**
 * Referensi Pustaka CRUD against the real database: create (details only,
 * via /api/references/upload), edit (PATCH) and delete (DELETE
 * /api/references/:articleId), plus who may do it. Runs the route handlers
 * directly with a fake login; works on its own throw-away project
 * ("uji-referensi-<id>"), removed again at the end. No server needed.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

const login = vi.hoisted(() => ({ userId: null as string | null }));
const graph = vi.hoisted(() => ({ upserts: [] as { id: string; title?: string | null }[], deletes: [] as string[] }));

const fakeLibServer = vi.hoisted(() => async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { Pool } = await import("pg");
  const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });
  return {
    prisma,
    getServerSession: async () => (login.userId ? { user: { id: login.userId } } : null),
    // ArcadeDB mirror: recorded, not sent.
    upsertGraphNode: async (node: { id: string; title?: string | null }) => void graph.upserts.push(node),
    deleteGraphForArticle: async (articleId: string) => void graph.deletes.push(articleId),
  };
});
// The routes reach the package through its built file, the test through the
// package name: mock both ids (one shared instance).
const shared = vi.hoisted(() => ({ mod: null as null | Promise<unknown> }));
vi.mock("@sre-monorepo/lib/server", () => (shared.mod ??= fakeLibServer()));
vi.mock("../../../../packages/lib/dist/server.js", () => (shared.mod ??= fakeLibServer()));

const { prisma } = await import("@sre-monorepo/lib/server");
const upload = await import("../../src/app/api/references/upload/route");
const one = await import("../../src/app/api/references/[articleId]/route");

const tag = `uji-referensi-${randomUUID().slice(0, 8)}`;
let owner = "";
let collaborator = "";
let stranger = "";
let brainstormId = "";
let writerId = "";

const as = (userId: string | null) => {
  login.userId = userId;
};
const params = (articleId: string) => ({ params: Promise.resolve({ articleId }) });
const patch = (articleId: string, body: unknown) =>
  one.PATCH(new Request(`http://t/api/references/${articleId}`, { method: "PATCH", body: JSON.stringify(body) }), params(articleId));
const del = (articleId: string) => one.DELETE(new Request(`http://t/api/references/${articleId}`, { method: "DELETE" }), params(articleId));

async function createWithoutPdf(fields: Record<string, string>) {
  const form = new FormData();
  form.append("projectId", writerId);
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  const res = await upload.POST(new Request("http://t/api/references/upload", { method: "POST", body: form }));
  return { status: res.status, body: await res.json() };
}

beforeAll(async () => {
  const users = await prisma.user.findMany({ select: { id: true }, take: 3, orderBy: { id: "asc" } });
  if (users.length < 3) throw new Error("Butuh minimal 3 user di database lokal.");
  [owner, collaborator, stranger] = users.map((u) => u.id);
  const brainstorm = await prisma.brainstormingSession.create({ data: { title: tag, userId: owner }, select: { id: true } });
  brainstormId = brainstorm.id;
  const writer = await prisma.writerSession.create({
    data: { title: tag, userId: owner, brainstormingSessionId: brainstormId, collaborators: { create: { userId: collaborator } } },
    select: { id: true },
  });
  writerId = writer.id;
});

afterAll(async () => {
  // Articles/nodes/edges cascade from the brainstorming session.
  await prisma.annotation.deleteMany({ where: { article: { sessionId: brainstormId } } }).catch(() => {});
  await prisma.writerSession.deleteMany({ where: { id: writerId } });
  await prisma.brainstormingSession.deleteMany({ where: { id: brainstormId } });
  await (prisma as unknown as { $disconnect: () => Promise<void> }).$disconnect();
});

describe("Referensi Pustaka: tambah → edit → hapus", () => {
  let articleId = "";

  test("tambah tanpa PDF (dari detail / RIS) membuat artikel + 1 node", async () => {
    as(owner);
    const res = await createWithoutPdf({ title: "Judul lama", author: "Salah, A.", year: "2020", doi: "10.1000/lama" });
    expect(res.status).toBe(200);
    expect(res.body.withoutPdf).toBe(true);
    articleId = res.body.article.id;
    const article = await prisma.article.findUniqueOrThrow({ where: { id: articleId } });
    expect(article).toMatchObject({ title: "Judul lama", filePath: "https://doi.org/10.1000/lama", sessionId: brainstormId });
    expect(await prisma.node.count({ where: { articleId } })).toBe(1);
  });

  test("kolaborator mengedit: artikel, node, dan tautan DOI ikut berubah", async () => {
    as(collaborator);
    const res = await patch(articleId, {
      title: "Judul baru yang benar",
      author: "Rahman, A.; Putri, S.",
      year: "2023",
      doi: "https://doi.org/10.1000/baru",
      abstract: "Abstrak baru",
      keywords: "energi, desa",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.article).toMatchObject({ id: articleId, title: "Judul baru yang benar", year: "2023", doi: "10.1000/baru" });

    const article = await prisma.article.findUniqueOrThrow({ where: { id: articleId } });
    expect(article).toMatchObject({ author: "Rahman, A.; Putri, S.", abstract: "Abstrak baru", keywords: "energi, desa", filePath: "https://doi.org/10.1000/baru" });
    const node = await prisma.node.findFirstOrThrow({ where: { articleId } });
    expect(node).toMatchObject({ title: "Judul baru yang benar", label: "Judul baru yang benar", att_background: "Abstrak baru", att_url: "https://doi.org/10.1000/baru" });
    expect(graph.upserts.some((n) => n.id === node.id && n.title === "Judul baru yang benar")).toBe(true);
  });

  test("judul kosong ditolak dan data tidak berubah", async () => {
    as(owner);
    const res = await patch(articleId, { title: "   ", author: "x" });
    expect(res.status).toBe(400);
    expect((await prisma.article.findUniqueOrThrow({ where: { id: articleId } })).title).toBe("Judul baru yang benar");
  });

  test("orang luar proyek dan tamu tidak bisa edit/hapus", async () => {
    as(stranger);
    expect((await patch(articleId, { title: "dibajak" })).status).toBe(403);
    expect((await del(articleId)).status).toBe(403);
    as(null);
    expect((await patch(articleId, { title: "dibajak" })).status).toBe(401);
    expect((await del(articleId)).status).toBe(401);
    expect((await prisma.article.findUniqueOrThrow({ where: { id: articleId } })).title).toBe("Judul baru yang benar");
  });

  test("hapus: artikel, node, dan anotasinya hilang; mirror graf ikut dihapus", async () => {
    await prisma.annotation.create({ data: { articleId, userId: owner, page: 1, highlightedText: "teks", comment: "catatan" } });
    as(collaborator);
    const res = await del(articleId);
    expect(res.status).toBe(200);
    expect(await prisma.article.count({ where: { id: articleId } })).toBe(0);
    expect(await prisma.node.count({ where: { articleId } })).toBe(0);
    expect(await prisma.annotation.count({ where: { articleId } })).toBe(0);
    expect(graph.deletes).toContain(articleId);
  });

  test("hapus/edit yang sudah terhapus → 404", async () => {
    as(owner);
    expect((await del(articleId)).status).toBe(404);
    expect((await patch(articleId, { title: "x" })).status).toBe(404);
  });
});

describe("Referensi ber-PDF", () => {
  test("edit hanya mengubah detail: PDF dan hasil analisis AI tetap", async () => {
    const article = await prisma.article.create({
      data: { title: "10.1145_3290605.pdf", filePath: "/uploads/uji.pdf", sessionId: brainstormId, userId: owner },
    });
    // Brain's AI picks the node type; it isn't always "article".
    await prisma.node.create({
      data: { label: "10.1145", title: "10.1145_3290605.pdf", type: "paper", content: "isi AI", att_background: "latar dari AI", att_url: "/uploads/uji.pdf", articleId: article.id },
    });
    as(owner);
    const res = await patch(article.id, { title: "Judul asli artikelnya", author: "Lee, K.", year: "2019", doi: "10.1145/3290605" });
    expect(res.status).toBe(200);
    expect(await prisma.article.findUniqueOrThrow({ where: { id: article.id } })).toMatchObject({ title: "Judul asli artikelnya", filePath: "/uploads/uji.pdf" });
    expect(await prisma.node.findFirstOrThrow({ where: { articleId: article.id } })).toMatchObject({
      title: "Judul asli artikelnya",
      att_background: "latar dari AI",
      content: "isi AI",
      att_url: "/uploads/uji.pdf",
    });
  });
});

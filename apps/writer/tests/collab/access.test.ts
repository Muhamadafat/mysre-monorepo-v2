/**
 * Who may open a draft. Checks the real rules against the real database
 * (read-only) for "Draft: Pengembangan web": its owner and collaborators get
 * in, everyone else is refused. Also checks the writer's API and pages refuse
 * a visitor who is not logged in, and whether the collaboration server
 * (PartyKit) itself checks access.
 */
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import * as Y from "yjs";
import YPartyKitProvider from "y-partykit/provider";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

// @sre-monorepo/lib/server also pulls in next/headers; the rules only need
// its Prisma client, built here the same way.
vi.mock("@sre-monorepo/lib/server", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { Pool } = await import("pg");
  return { prisma: new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) }) };
});

const { prisma } = await import("@sre-monorepo/lib/server");
const { canAccessWriterSession, isWriterSessionOwner } = await import("@/lib/writerSessionAccess");

const DRAFT_TITLE = "Draft: Pengembangan web";
const WRITER_URL = process.env.WRITER_URL ?? "http://localhost:3003";
const PARTY_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "127.0.0.1:1999";

let sessionId = "";
let owner = "";
let collaborators: string[] = [];
let strangers: string[] = [];

beforeAll(async () => {
  const session = await prisma.writerSession.findFirstOrThrow({
    where: { title: DRAFT_TITLE },
    select: { id: true, userId: true, collaborators: { select: { userId: true } } },
  });
  sessionId = session.id;
  owner = session.userId;
  collaborators = session.collaborators.map((c) => c.userId);
  const others = await prisma.user.findMany({
    where: { id: { notIn: [owner, ...collaborators] } },
    select: { id: true },
    take: 5,
  });
  strangers = others.map((u) => u.id);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe(`Hak akses naskah "${DRAFT_TITLE}" (aturan aplikasi + database)`, () => {
  test("pemilik naskah boleh membuka", async ({ annotate }) => {
    await annotate(`user ${owner.slice(0, 8)}…`);
    expect(await canAccessWriterSession(sessionId, owner)).toBe(true);
  });

  test("setiap kolaborator boleh membuka", async ({ annotate }) => {
    await annotate(`${collaborators.length} kolaborator dicek`);
    expect(collaborators.length, "naskah uji punya kolaborator").toBeGreaterThan(0);
    for (const userId of collaborators) {
      expect(await canAccessWriterSession(sessionId, userId), `kolaborator ${userId.slice(0, 8)}…`).toBe(true);
    }
  });

  test("user lain (bukan pemilik/kolaborator) ditolak", async ({ annotate }) => {
    await annotate(`${strangers.length} user lain dicek`);
    for (const userId of strangers) {
      expect(await canAccessWriterSession(sessionId, userId), `user ${userId.slice(0, 8)}…`).toBe(false);
    }
  });

  test("naskah yang tidak ada ditolak", async () => {
    expect(await canAccessWriterSession(randomUUID(), owner)).toBe(false);
  });

  test("hanya pemilik yang bisa mengatur kolaborator", async () => {
    expect(await isWriterSessionOwner(sessionId, owner), "pemilik").toBe(true);
    for (const userId of collaborators) {
      expect(await isWriterSessionOwner(sessionId, userId), `kolaborator ${userId.slice(0, 8)}…`).toBe(false);
    }
  });
});

describe("Pengunjung yang belum login (server writer)", () => {
  test("API membaca naskah menolak (401)", async () => {
    const res = await fetch(`${WRITER_URL}/api/draft/list?writerSessionId=${sessionId}`);
    expect(res.status).toBe(401);
  });

  test("API membuka sesi naskah menolak (401)", async () => {
    const res = await fetch(`${WRITER_URL}/api/writer-sessions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: sessionId }),
    });
    expect(res.status).toBe(401);
  });

  test("halaman naskah dialihkan ke halaman login", async ({ annotate }) => {
    const res = await fetch(`${WRITER_URL}/project/${sessionId}/draft`, { redirect: "manual" });
    await annotate(`status ${res.status} -> ${res.headers.get("location")?.split("?")[0]}`);
    expect([302, 303, 307, 308]).toContain(res.status);
    expect(res.headers.get("location") ?? "").toContain("signin");
  });
});

describe("Server kolaborasi (PartyKit)", () => {
  // A client that never logged in connects straight to the draft's room id.
  // It only listens (empty document, no edits), so the real draft is not
  // changed. If the server lets it sync, anyone who learns a room id can
  // read the draft live.
  test("menolak koneksi langsung tanpa login", async ({ annotate }) => {
    const doc = new Y.Doc();
    const provider = new YPartyKitProvider(PARTY_HOST, sessionId, doc, { WebSocketPolyfill: WebSocket as never });
    const synced = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 5000);
      provider.on("sync", (isSynced: boolean) => {
        if (isSynced) {
          clearTimeout(timer);
          resolve(true);
        }
      });
    });
    const received = Y.encodeStateAsUpdate(doc).byteLength;
    provider.destroy();
    doc.destroy();
    await annotate(
      synced
        ? `CELAH: tersambung tanpa login dan menerima ${received} byte isi naskah`
        : "ditolak (tidak tersambung dalam 5 detik)",
    );
    expect(synced, "PartyKit tidak boleh melayani klien yang belum login").toBe(false);
  });
});

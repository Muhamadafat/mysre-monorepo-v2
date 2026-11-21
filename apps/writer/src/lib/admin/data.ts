import * as Y from "yjs";
import YPartyKitProvider from "y-partykit/provider";
import { yTextToSlateElement } from "@slate-yjs/core";
import { prisma } from "@sre-monorepo/lib/server";
import { describeCall } from "@/lib/voice/commandCatalog";

/**
 * Read-only data for the admin page (/admin). Only SELECTs and a read-only
 * Yjs sync — nothing here writes to Postgres, S3 or PartyKit.
 */

const recordingUrls = (id: string, hasWav: boolean) => ({
  url: `/api/admin/audio?id=${id}`,
  downloadUrl: `/api/admin/audio?id=${id}&download=1`,
  wavUrl: hasWav ? `/api/admin/audio?id=${id}&file=wav` : null,
  wavDownloadUrl: hasWav ? `/api/admin/audio?id=${id}&file=wav&download=1` : null,
});

/** All writers with a summary of what they made, most recently active first. */
export async function listStudents() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      nim: true,
      group: true,
      university: true,
      major: true,
      role: true,
      avatar_url: true,
      lastActive: true,
      createdAt: true,
      _count: {
        select: {
          writerSessions: true,
          writerSessionCollaborations: true,
          drafts: true,
          articles: true,
          annotations: true,
          voiceRecordings: true,
        },
      },
    },
  });

  const [lastDraft, lastRecording, recordingBytes, lastSession] = await Promise.all([
    prisma.draft.groupBy({ by: ["userId"], _max: { createdAt: true } }),
    prisma.voiceRecording.groupBy({ by: ["userId"], _max: { startedAt: true }, _sum: { sizeBytes: true } }),
    prisma.voiceRecording.groupBy({ by: ["userId", "mode"], _count: { _all: true } }),
    prisma.writerSession.groupBy({ by: ["userId"], _max: { lastActivity: true } }),
  ]);
  const byUser = <T extends { userId: string | null }>(rows: T[]) => new Map(rows.map((r) => [r.userId ?? "", r]));
  const drafts = byUser(lastDraft);
  const recs = byUser(lastRecording);
  const sessions = byUser(lastSession);

  return users
    .map((user) => {
      const modes = recordingBytes.filter((r) => r.userId === user.id);
      const dates = [
        user.lastActive,
        drafts.get(user.id)?._max.createdAt,
        recs.get(user.id)?._max.startedAt,
        sessions.get(user.id)?._max.lastActivity,
      ].filter(Boolean) as Date[];
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        nim: user.nim,
        group: user.group,
        university: user.university,
        major: user.major,
        role: user.role,
        avatarUrl: user.avatar_url,
        createdAt: user.createdAt,
        lastActivity: dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null,
        counts: {
          projects: user._count.writerSessions,
          collaborations: user._count.writerSessionCollaborations,
          drafts: user._count.drafts,
          articles: user._count.articles,
          annotations: user._count.annotations,
          recordings: user._count.voiceRecordings,
          recordingsMenulis: modes.find((m) => m.mode === "menulis")?._count._all ?? 0,
          recordingsPerintah: modes.find((m) => m.mode === "perintah")?._count._all ?? 0,
        },
        recordingBytes: recs.get(user.id)?._sum.sizeBytes ?? 0,
      };
    })
    .sort((a, b) => (b.lastActivity?.getTime() ?? 0) - (a.lastActivity?.getTime() ?? 0));
}

/** Bibliography entry as saved by the draft page (see Bibliography in draft/page.tsx). */
export interface SavedBibliography {
  number: number;
  author?: string;
  title?: string;
  year?: string;
  journal?: string;
  publisher?: string;
  url?: string;
  doi?: string;
}

const bibliographyOf = (data: unknown): SavedBibliography[] | null => {
  const list = (data as { bibliography?: unknown } | null)?.bibliography;
  return Array.isArray(list) ? (list as SavedBibliography[]) : null;
};

/** One student's whole portfolio: projects, versions, references, recordings. */
export async function studentPortfolio(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      nim: true,
      group: true,
      university: true,
      faculty: true,
      major: true,
      semester: true,
      avatar_url: true,
      lastActive: true,
      createdAt: true,
    },
  });
  if (!user) return null;

  const sessionSelect = {
    id: true,
    title: true,
    description: true,
    coverColor: true,
    createdAt: true,
    updatedAt: true,
    lastActivity: true,
    userId: true,
    user: { select: { id: true, name: true, email: true } },
    collaborators: { select: { role: true, user: { select: { id: true, name: true, email: true } } } },
    brainstormingSession: {
      select: {
        id: true,
        title: true,
        articles: {
          select: { id: true, title: true, author: true, year: true, doi: true, createdAt: true },
          orderBy: { createdAt: "asc" as const },
        },
      },
    },
    drafts: {
      select: { id: true, title: true, createdAt: true, userId: true, conceptMapData: true, _count: { select: { sections: true } } },
      orderBy: { createdAt: "desc" as const },
    },
  };

  const [owned, collaborations, recordings, annotations, aiUsage] = await Promise.all([
    prisma.writerSession.findMany({ where: { userId }, select: sessionSelect, orderBy: { lastActivity: "desc" } }),
    prisma.writerSession.findMany({
      where: { collaborators: { some: { userId } }, NOT: { userId } },
      select: sessionSelect,
      orderBy: { lastActivity: "desc" },
    }),
    prisma.voiceRecording.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      include: { commandRuns: { orderBy: { createdAt: "asc" }, include: { calls: { orderBy: { position: "asc" } } } } },
    }),
    prisma.annotation.count({ where: { userId } }),
    prisma.tokenUsage.groupBy({ by: ["purpose"], where: { userId }, _count: { _all: true }, _sum: { tokensUsed: true } }),
  ]);

  const projectTitle = new Map([...owned, ...collaborations].map((s) => [s.id, s.title]));

  const projects = [...owned.map((s) => ({ ...s, relation: "pemilik" as const })), ...collaborations.map((s) => ({ ...s, relation: "kolaborator" as const }))].map(
    (session) => {
      const latestBib = session.drafts.map((d) => bibliographyOf(d.conceptMapData)).find(Boolean) ?? [];
      return {
        id: session.id,
        title: session.title,
        description: session.description,
        coverColor: session.coverColor,
        relation: session.relation,
        owner: session.user,
        collaborators: session.collaborators.map((c) => ({ ...c.user, role: c.role })),
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        brainstorming: session.brainstormingSession ? { id: session.brainstormingSession.id, title: session.brainstormingSession.title } : null,
        references: session.brainstormingSession?.articles ?? [],
        bibliography: latestBib,
        drafts: session.drafts.map((d) => ({
          id: d.id,
          title: d.title,
          createdAt: d.createdAt,
          byStudent: d.userId === userId,
          blocks: d._count.sections,
          bibliographyCount: bibliographyOf(d.conceptMapData)?.length ?? 0,
        })),
        recordingCount: recordings.filter((r) => r.projectId === session.id).length,
      };
    }
  );

  return {
    user,
    stats: {
      projects: owned.length,
      collaborations: collaborations.length,
      drafts: projects.reduce((n, p) => n + p.drafts.filter((d) => d.byStudent).length, 0),
      references: projects.reduce((n, p) => n + p.references.length, 0),
      bibliography: projects.reduce((n, p) => n + p.bibliography.length, 0),
      annotations,
      recordings: recordings.length,
      recordingSeconds: Math.round(
        recordings.reduce((sum, r) => sum + (r.startedAt && r.endedAt ? Math.max(0, r.endedAt.getTime() - r.startedAt.getTime()) : 0), 0) / 1000
      ),
      aiUsage: aiUsage.map((u) => ({ purpose: u.purpose, calls: u._count._all, tokens: u._sum.tokensUsed ?? 0 })),
    },
    projects,
    recordings: recordings.map((r) => {
      const last = r.commandRuns[r.commandRuns.length - 1];
      const hasWav = Boolean(r.wavKey && r.wavKey !== r.audioKey);
      return {
        id: r.id,
        mode: r.mode,
        projectId: r.projectId,
        projectTitle: (r.projectId && projectTitle.get(r.projectId)) || null,
        startedAt: r.startedAt,
        endedAt: r.endedAt,
        durationSeconds: r.startedAt && r.endedAt ? Math.max(0, Math.round((r.endedAt.getTime() - r.startedAt.getTime()) / 1000)) : null,
        sizeBytes: r.sizeBytes,
        wavSizeBytes: hasWav ? r.wavSizeBytes : null,
        transcript: (Array.isArray(r.transcript) ? r.transcript : []) as { at: string; role: string; text: string }[],
        aiTranscript: r.aiTranscript,
        command:
          r.mode === "perintah"
            ? {
                status: last?.status ?? "belum_dijalankan",
                intent: last?.intent ?? null,
                text: last?.text ?? null,
                runs: r.commandRuns.length,
                actions: (last?.calls ?? []).map((call) => {
                  const described = describeCall(call.tool, (call.args ?? {}) as Record<string, unknown>);
                  return { command: described.command ?? call.tool, intent: call.intent, ok: call.ok, message: call.message };
                }),
              }
            : null,
        ...recordingUrls(r.id, hasWav),
      };
    }),
  };
}

/** Slate element (live doc / saved block) in the small shape the page renders. */
export type DocNode = { type?: string; text?: string; children?: DocNode[]; [key: string]: unknown };

/**
 * The live document of a project from the PartyKit room (room id =
 * WriterSession id), read with a throw-away Yjs client. Read-only: the
 * client never changes its Y.Doc, so it never sends an update.
 * Also returns the collaborator names and comment threads kept on the same
 * Y.Doc. Null when PartyKit isn't reachable within `timeoutMs`.
 */
export interface LiveCommentReply {
  id: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  text: string;
  createdAt: number;
}

export interface LiveCommentThread {
  id: string;
  quote: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  createdAt: number;
  resolved: boolean;
  /** replies[0] is the opening comment. */
  replies: LiveCommentReply[];
}

export interface LiveDocument {
  nodes: DocNode[];
  /** userId -> display name, from the shared `contributors` Y.Map. */
  contributorNames: Record<string, string>;
  /** Same threads the editor's "Komentar" panel shows, newest first. */
  comments: LiveCommentThread[];
}

/** Rebuilds comment threads from the two flat Y.Maps the editor writes (see PlateEditor). */
function readComments(doc: Y.Doc): LiveCommentThread[] {
  const threads = new Map<string, LiveCommentThread>();
  doc.getMap<Omit<LiveCommentThread, "replies">>("commentThreads").forEach((meta, id) => {
    threads.set(id, { ...meta, id, replies: [] });
  });
  doc.getMap<LiveCommentReply & { threadId: string }>("commentReplies").forEach((reply) => {
    const { threadId, ...rest } = reply;
    threads.get(threadId)?.replies.push(rest);
  });
  const list = [...threads.values()];
  list.forEach((t) => t.replies.sort((a, b) => a.createdAt - b.createdAt));
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export async function readLiveDocument(roomId: string, timeoutMs = 5000): Promise<LiveDocument | null> {
  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
  if (!host || typeof WebSocket === "undefined") return null;
  const doc = new Y.Doc();
  const provider = new YPartyKitProvider(host, roomId, doc, {
    connect: true,
    WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket,
  });
  try {
    const synced = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      provider.on("sync", (ok: boolean) => {
        if (!ok) return;
        clearTimeout(timer);
        resolve(true);
      });
    });
    if (!synced) return null;
    const root = yTextToSlateElement(doc.get("content", Y.XmlText));
    return {
      nodes: (root.children ?? []) as DocNode[],
      contributorNames: doc.getMap<string>("contributors").toJSON() as Record<string, string>,
      comments: readComments(doc),
    };
  } catch {
    return null;
  } finally {
    provider.destroy();
    doc.destroy();
  }
}

/** A saved version ("Simpan Versi") as BlockNote-style blocks + its bibliography. */
export async function readSavedDraft(draftId: string) {
  const draft = await prisma.draft.findUnique({
    where: { id: draftId },
    select: { id: true, title: true, createdAt: true, writerId: true, conceptMapData: true, sections: { select: { content: true } } },
  });
  if (!draft) return null;
  const blocks = draft.sections
    .map((section) => {
      try {
        const parsed = JSON.parse(section.content);
        return { order: Number(parsed.order ?? 0), block: parsed.originalBlock ?? { type: parsed.type, props: parsed.props, content: parsed.content } };
      } catch {
        return { order: 999999, block: { type: "paragraph", content: section.content } };
      }
    })
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.block);
  return {
    id: draft.id,
    title: draft.title,
    createdAt: draft.createdAt,
    projectId: draft.writerId,
    blocks,
    bibliography: bibliographyOf(draft.conceptMapData) ?? [],
  };
}

/** Recording row (for streaming / zipping) with the owner's name. */
export async function findRecordingRow(id: string) {
  return prisma.voiceRecording.findUnique({
    where: { id },
    select: { id: true, userId: true, projectId: true, mode: true, audioKey: true, wavKey: true, startedAt: true, user: { select: { name: true, email: true } } },
  });
}

/** Rows for the ZIP download: one student, or everyone (userId null). */
export async function recordingsForZip(userId: string | null) {
  const rows = await prisma.voiceRecording.findMany({
    where: userId ? { userId } : {},
    orderBy: [{ userId: "asc" }, { startedAt: "asc" }],
    select: {
      id: true,
      projectId: true,
      mode: true,
      audioKey: true,
      wavKey: true,
      startedAt: true,
      transcript: true,
      aiTranscript: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
  const projectIds = [...new Set(rows.map((r) => r.projectId).filter(Boolean))] as string[];
  const projects = await prisma.writerSession.findMany({ where: { id: { in: projectIds } }, select: { id: true, title: true } });
  const titles = new Map(projects.map((p) => [p.id, p.title]));
  return rows.map((r) => ({ ...r, projectTitle: (r.projectId && titles.get(r.projectId)) || null }));
}

/** Safe piece of a file name: letters, digits, space, - and _. */
export function fileSafe(value: string | null | undefined, fallback: string): string {
  const cleaned = String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return cleaned || fallback;
}

/** 2026-11-19T05:11:24Z → "20261119-121124" (server local time, like the S3 names). */
export function stamp(date: Date | null | undefined): string {
  if (!date) return "tanpa-waktu";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

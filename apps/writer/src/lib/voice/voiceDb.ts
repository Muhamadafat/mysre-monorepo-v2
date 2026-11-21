import { prisma } from "@sre-monorepo/lib/server";
import type { CommandRun, RecordingMeta } from "@/lib/storage/recordingKeys";
import {
  COMMAND_CATALOG,
  COMMAND_FLOWS,
  FLOW_TIP,
  TARGET_LABEL,
  catalogHelp,
  describeCall,
  type CommandHelp,
  type CommandTarget,
  type HelpCommand,
} from "@/lib/voice/commandCatalog";

/**
 * Postgres mirror of the voice recordings (tables VoiceRecording,
 * VoiceCommandRun, VoiceCommandCall in prisma/schema.prisma). The audio and
 * its .json stay in S3; these rows make intents, tools, functions and results
 * queryable in SQL.
 *
 * Every write is best effort: S3 is what the app reads, so a database hiccup
 * is logged and never fails the request. `npm run voice:db-sync` (apps/writer)
 * fills in whatever is missing from S3.
 */

export type RunStatus = "berhasil" | "gagal" | "tidak_dikenali";

export function runStatus(run: Pick<CommandRun, "calls">): RunStatus {
  if (!run.calls.length) return "tidak_dikenali";
  return run.calls.every(call => call.ok) ? "berhasil" : "gagal";
}

const toDate = (value: string | null | undefined) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const json = (value: unknown) => JSON.parse(JSON.stringify(value ?? null));

function recordingData(meta: RecordingMeta) {
  return {
    userId: meta.userId,
    projectId: meta.projectId && meta.projectId !== "tanpa-project" ? meta.projectId : null,
    mode: meta.mode,
    audioKey: meta.audioKey,
    wavKey: meta.wavKey ?? null,
    mimeType: meta.mimeType ?? null,
    sizeBytes: Math.round(meta.sizeBytes || 0),
    wavSizeBytes: meta.wavSizeBytes ?? null,
    startedAt: toDate(meta.startedAt),
    endedAt: toDate(meta.endedAt),
    transcript: json(meta.transcript ?? []),
    aiTranscript: meta.aiTranscript?.text ?? null,
  };
}

/** Creates or refreshes the recording row (not its runs). */
export async function upsertRecordingRow(uuid: string, meta: RecordingMeta) {
  const data = recordingData(meta);
  await prisma.voiceRecording.upsert({ where: { id: uuid }, create: { id: uuid, ...data }, update: data });
}

/** One run with its calls, in order; intent / function / target from the catalog. */
export async function insertRunRow(uuid: string, run: CommandRun) {
  await prisma.voiceCommandRun.create({
    data: {
      recordingId: uuid,
      source: run.source,
      text: run.text,
      intent: run.intent ?? (run.calls[0] ? describeCall(run.calls[0].tool, run.calls[0].args).intent : null),
      status: runStatus(run),
      reply: run.reply,
      createdAt: toDate(run.at) ?? new Date(),
      calls: {
        create: run.calls.map((call, position) => {
          const described = describeCall(call.tool, call.args);
          return {
            position,
            tool: call.tool,
            args: json(call.args ?? {}),
            intent: described.intent ?? call.intent ?? null,
            function: described.function ?? call.function ?? null,
            target: described.target,
            ok: call.ok,
            message: call.message,
          };
        }),
      },
    },
  });
}

const logFailure = (what: string) => (err: unknown) => {
  console.error(`[voice/db] ${what} gagal disimpan ke Postgres:`, err);
};

/** After POST /api/voice/recording. */
export const saveRecordingToDb = (uuid: string, meta: RecordingMeta) =>
  upsertRecordingRow(uuid, meta).catch(logFailure("rekaman"));

/** After a Mode Perintah run is logged (the recording row is made first if it's missing). */
export const saveRunToDb = (uuid: string, meta: RecordingMeta, run: CommandRun) =>
  upsertRecordingRow(uuid, meta)
    .then(() => insertRunRow(uuid, run))
    .catch(logFailure("hasil perintah"));

/** After a recording is deleted from S3 (runs and calls go with it). */
export const deleteRecordingFromDb = (uuid: string) =>
  prisma.voiceRecording.deleteMany({ where: { id: uuid } }).catch(logFailure("hapus rekaman"));

/** After "Transkrip AI". */
export const saveAiTranscriptToDb = (uuid: string, meta: RecordingMeta) =>
  upsertRecordingRow(uuid, meta).catch(logFailure("transkrip AI"));

/**
 * Makes the rows of one recording match its S3 .json exactly: the recording
 * row, and its runs replaced by the ones in `commandRuns`. Safe to repeat.
 */
export async function syncRecordingRows(uuid: string, meta: RecordingMeta) {
  await upsertRecordingRow(uuid, meta);
  await prisma.voiceCommandRun.deleteMany({ where: { recordingId: uuid } });
  for (const run of meta.commandRuns ?? []) await insertRunRow(uuid, run);
}

// ---- Command list (tables VoiceCommand / VoiceCommandTarget / VoiceCommandFlow) ----

/**
 * Makes the command tables equal to commandCatalog.ts (= the Excel): upserts
 * every target, command and flow, and deletes rows no longer in the catalog.
 * Run by `npm run voice:db-sync`. Returns the row counts.
 */
export async function syncCommandCatalog() {
  const targets = Object.keys(TARGET_LABEL) as CommandTarget[];
  const intents = COMMAND_CATALOG.map(row => row.intent);
  let no = 0;
  await prisma.$transaction([
    ...targets.map((id, sortOrder) =>
      prisma.voiceCommandTarget.upsert({
        where: { id },
        create: { id, label: TARGET_LABEL[id], sortOrder },
        update: { label: TARGET_LABEL[id], sortOrder },
      })
    ),
    ...COMMAND_CATALOG.map((row, sortOrder) => {
      const data = {
        no: row.group === "nonaktif" ? null : ++no,
        group: row.group,
        sortOrder,
        command: row.command,
        example: row.example,
        keywords: row.keywords,
        action: row.action,
        targetId: row.target,
        tool: row.tool,
        function: row.fn,
      };
      return prisma.voiceCommand.upsert({ where: { intent: row.intent }, create: { intent: row.intent, ...data }, update: data });
    }),
    ...COMMAND_FLOWS.map((flow, sortOrder) => {
      const data = { sortOrder, say: flow.say, result: flow.result, thenSay: flow.thenSay, outcome: flow.outcome };
      return prisma.voiceCommandFlow.upsert({ where: { intent: flow.intent }, create: { intent: flow.intent, ...data }, update: data });
    }),
    prisma.voiceCommandFlow.deleteMany({ where: { intent: { notIn: COMMAND_FLOWS.map(flow => flow.intent) } } }),
    prisma.voiceCommand.deleteMany({ where: { intent: { notIn: intents } } }),
    prisma.voiceCommandTarget.deleteMany({ where: { id: { notIn: targets } } }),
  ]);
  return { commands: COMMAND_CATALOG.length, flows: COMMAND_FLOWS.length, targets: targets.length };
}

/**
 * Help pop-up content from Postgres (active commands only, no tool/function).
 * Falls back to the catalog file when the tables are empty or unreachable.
 */
export async function readCommandHelp(): Promise<CommandHelp> {
  try {
    const [commands, flows, targets] = await Promise.all([
      prisma.voiceCommand.findMany({
        where: { group: { in: ["utama", "pendukung"] } },
        include: { target: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.voiceCommandFlow.findMany({ include: { command: { select: { command: true } } }, orderBy: { sortOrder: "asc" } }),
      prisma.voiceCommandTarget.findMany({ orderBy: { sortOrder: "asc" } }),
    ]);
    if (!commands.length) return catalogHelp();
    return {
      commands: commands.map(row => ({
        no: row.no ?? 0,
        intent: row.intent,
        group: row.group as HelpCommand["group"],
        command: row.command,
        example: row.example,
        keywords: row.keywords,
        action: row.action,
        target: row.targetId as CommandTarget,
        targetLabel: row.target.label,
      })),
      flows: flows.map(flow => ({
        intent: flow.intent,
        command: flow.command.command,
        say: flow.say,
        result: flow.result,
        thenSay: flow.thenSay,
        outcome: flow.outcome,
      })),
      targets: targets.map(target => ({ id: target.id as CommandTarget, label: target.label })),
      tip: FLOW_TIP,
      source: "db",
    };
  } catch (err) {
    console.error("[voice/db] daftar perintah gagal dibaca dari Postgres, pakai katalog:", err);
    return catalogHelp();
  }
}

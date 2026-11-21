import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * S3 → Postgres sync of the voice recordings, then a check that the rows
 * are right. `npm run voice:db-sync` (apps/writer; needs .env with S3_* and
 * DATABASE_URL). Safe to run again: each recording's rows are replaced.
 *
 *  1. every recording .json in S3 → VoiceRecording (+ its runs and calls)
 *  2. row counts match S3 (recordings, runs, calls)
 *  3. every stored intent / function / target is the catalog's (= the Excel)
 *  4. the command list itself (VoiceCommand / VoiceCommandFlow /
 *     VoiceCommandTarget = sheets Perintah Suara / Alur Pakai / Tujuan Hasil)
 *     equals commandCatalog.ts
 */
process.loadEnvFile(path.join(process.cwd(), ".env"));

type Synced = Awaited<ReturnType<typeof import("@/lib/storage/listRecordings")["listAllRecordingMetas"]>>;

const recordings: Synced = [];
let prisma: typeof import("@sre-monorepo/lib/server")["prisma"];
let catalog: typeof import("@/lib/voice/commandCatalog");
const skipped: string[] = [];

beforeAll(async () => {
  // Imported after the .env is loaded (the clients read it on import).
  const storage = await import("@/lib/storage/listRecordings");
  const db = await import("@/lib/voice/voiceDb");
  prisma = (await import("@sre-monorepo/lib/server")).prisma;
  catalog = await import("@/lib/voice/commandCatalog");

  // The command list first: recordings refer to its intents.
  const counts = await db.syncCommandCatalog();
  console.log(`Daftar perintah: ${counts.commands} perintah, ${counts.flows} alur, ${counts.targets} tujuan hasil`);

  const all = await storage.listAllRecordingMetas();
  const users = new Set((await prisma.user.findMany({ select: { id: true } })).map(user => user.id));
  for (const item of all) {
    if (!users.has(item.meta.userId)) {
      skipped.push(`${item.uuid} (user ${item.meta.userId} tidak ada di tabel User)`);
      continue;
    }
    await db.syncRecordingRows(item.uuid, item.meta);
    recordings.push(item);
  }
  console.log(`Disinkronkan: ${recordings.length} rekaman; dilewati: ${skipped.length}`);
  for (const line of skipped) console.log(`  dilewati: ${line}`);
}, 300_000);

describe("voice recordings in Postgres", () => {
  it("has a row for every recording in S3", async () => {
    const ids = recordings.map(item => item.uuid);
    const rows = await prisma.voiceRecording.findMany({ where: { id: { in: ids } }, select: { id: true, audioKey: true, mode: true } });
    expect(rows.length).toBe(ids.length);
    const byId = new Map(rows.map(row => [row.id, row]));
    for (const item of recordings) {
      expect(byId.get(item.uuid)?.audioKey).toBe(item.meta.audioKey);
      expect(byId.get(item.uuid)?.mode).toBe(item.meta.mode);
    }
  });

  it("has every command run and tool call", async () => {
    const ids = recordings.map(item => item.uuid);
    const runsInS3 = recordings.reduce((sum, item) => sum + (item.meta.commandRuns?.length ?? 0), 0);
    const callsInS3 = recordings.reduce(
      (sum, item) => sum + (item.meta.commandRuns ?? []).reduce((n, run) => n + run.calls.length, 0),
      0
    );
    expect(await prisma.voiceCommandRun.count({ where: { recordingId: { in: ids } } })).toBe(runsInS3);
    expect(await prisma.voiceCommandCall.count({ where: { run: { recordingId: { in: ids } } } })).toBe(callsInS3);
  });

  it("stores the catalog's (Excel's) intent, function and target for each call", async () => {
    const calls = await prisma.voiceCommandCall.findMany({
      where: { run: { recordingId: { in: recordings.map(item => item.uuid) } } },
      include: { run: { select: { intent: true, status: true, text: true } } },
      orderBy: [{ runId: "asc" }, { position: "asc" }],
    });
    for (const call of calls) {
      const expected = catalog.describeCall(call.tool, (call.args ?? {}) as Record<string, unknown>);
      expect(call.intent).toBe(expected.intent);
      expect(call.function).toBe(expected.function);
      expect(call.target).toBe(expected.target);
      if (call.intent) expect(catalog.COMMAND_CATALOG.some(row => row.intent === call.intent)).toBe(true);
      console.log(
        `  ${call.run.status.padEnd(14)} ${String(call.intent).padEnd(24)} ${call.tool.padEnd(24)} ${call.function}  ← "${call.run.text.slice(0, 50)}"`
      );
    }
  });
});

describe("command list in Postgres (= Excel)", () => {
  it("has every command of the catalog with the same columns", async () => {
    const rows = await prisma.voiceCommand.findMany({ orderBy: { sortOrder: "asc" } });
    expect(rows.map(row => row.intent)).toEqual(catalog.COMMAND_CATALOG.map(row => row.intent));
    let no = 0;
    catalog.COMMAND_CATALOG.forEach((entry, i) => {
      const row = rows[i];
      expect(row).toMatchObject({
        no: entry.group === "nonaktif" ? null : ++no,
        group: entry.group,
        command: entry.command,
        example: entry.example,
        keywords: entry.keywords,
        action: entry.action,
        targetId: entry.target,
        tool: entry.tool,
        function: entry.fn,
      });
    });
    console.log(`  ${rows.filter(row => row.group !== "nonaktif").length} perintah aktif, ${rows.filter(row => row.group === "nonaktif").length} nonaktif`);
  });

  it("has the Alur Pakai and Tujuan Hasil sheets", async () => {
    const flows = await prisma.voiceCommandFlow.findMany({ orderBy: { sortOrder: "asc" } });
    expect(flows.map(({ intent, say, result, thenSay, outcome }) => ({ intent, say, result, thenSay, outcome }))).toEqual(
      catalog.COMMAND_FLOWS
    );
    const targets = await prisma.voiceCommandTarget.findMany({ orderBy: { sortOrder: "asc" } });
    expect(Object.fromEntries(targets.map(target => [target.id, target.label]))).toEqual(catalog.TARGET_LABEL);
  });

  it("serves the help pop-up from the database", async () => {
    const db = await import("@/lib/voice/voiceDb");
    const help = await db.readCommandHelp();
    expect(help.source).toBe("db");
    const fromFile = catalog.catalogHelp();
    expect({ ...help, source: "catalog" }).toEqual(fromFile);
  });
});

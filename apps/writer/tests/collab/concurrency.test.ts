/**
 * How many users can open and edit one draft at the same time. For each
 * level (2, 5, 10, 20, 30, 50, 75, 100 users) simulated users join a fresh test room
 * on the real PartyKit server (never a real draft's room) and:
 *   1. connect and receive the document,
 *   2. see each other online (awareness, the coloured cursors),
 *   3. see one user's typing appear on everyone else's screen,
 *   4. all type at the same moment and end up with identical documents.
 * Each level's numbers are also appended to logs/collab-test.jsonl.
 *
 * Measures the local dev PartyKit server; the deployed server runs on
 * different hardware, so its numbers will differ.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import WebSocket from "ws";
import * as Y from "yjs";
import YPartyKitProvider from "y-partykit/provider";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const PARTY_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "127.0.0.1:1999";
const LEVELS = (process.env.COLLAB_LEVELS ?? "2,5,10,20,30,50,75,100").split(",").map(Number);
const JSONL = path.join(process.cwd(), "logs", "collab-test.jsonl");
const RUN_ID = Date.now();

/** Targets: typing shows up for the others within 1 s, everyone in sync within 3 s. */
const TARGET = { connectMs: 5000, propagateMs: 1000, convergeMs: 3000 };

type Client = { doc: Y.Doc; provider: YPartyKitProvider; text: Y.Text; connectMs: number | null };

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : NaN;
};

/** Resolves with the elapsed ms once `check` is true (re-checked on every doc update), or null on timeout. */
function waitFor(docs: Y.Doc[], check: () => boolean, timeoutMs: number): Promise<number | null> {
  const start = performance.now();
  return new Promise((resolve) => {
    const done = (value: number | null) => {
      clearTimeout(timer);
      docs.forEach((d) => d.off("update", onUpdate));
      resolve(value);
    };
    const onUpdate = () => check() && done(Math.round(performance.now() - start));
    const timer = setTimeout(() => done(null), timeoutMs);
    docs.forEach((d) => d.on("update", onUpdate));
    if (check()) done(0);
  });
}

function connect(room: string, index: number): Promise<Client> {
  const doc = new Y.Doc();
  const provider = new YPartyKitProvider(PARTY_HOST, room, doc, { WebSocketPolyfill: WebSocket as never });
  provider.awareness.setLocalStateField("user", { name: `Penguji ${index + 1}` });
  const start = performance.now();
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ doc, provider, text: doc.getText("uji"), connectMs: null }), 15_000);
    provider.on("sync", (isSynced: boolean) => {
      if (!isSynced) return;
      clearTimeout(timer);
      resolve({ doc, provider, text: doc.getText("uji"), connectMs: Math.round(performance.now() - start) });
    });
  });
}

for (const users of LEVELS) {
  describe(`${users} user membuka naskah yang sama`, () => {
    const room = `uji-beban-${RUN_ID}-${users}`;
    let clients: Client[] = [];
    const result: Record<string, unknown> = { ts: new Date().toISOString(), users, room };

    beforeAll(async () => {
      clients = await Promise.all(Array.from({ length: users }, (_, i) => connect(room, i)));
    });

    afterAll(() => {
      for (const c of clients) {
        c.provider.destroy();
        c.doc.destroy();
      }
      mkdirSync(path.dirname(JSONL), { recursive: true });
      appendFileSync(JSONL, JSON.stringify(result) + "\n");
    });

    test("semua user berhasil tersambung", async ({ annotate }) => {
      const times = clients.map((c) => c.connectMs).filter((ms): ms is number => ms !== null);
      Object.assign(result, {
        connected: times.length,
        connectP50: percentile(times, 50),
        connectP95: percentile(times, 95),
        connectMax: Math.max(...times),
      });
      await annotate(`${times.length}/${users} tersambung, p50=${result.connectP50} ms, p95=${result.connectP95} ms, maks=${result.connectMax} ms`);
      expect(times.length, "jumlah user tersambung").toBe(users);
      expect(Math.max(...times), `waktu tersambung paling lama (target ${TARGET.connectMs} ms)`).toBeLessThanOrEqual(TARGET.connectMs);
    });

    test("semua user saling terlihat online", async ({ annotate }) => {
      const seen = () => clients.map((c) => c.provider.awareness.getStates().size);
      const start = performance.now();
      while (Math.min(...seen()) < users && performance.now() - start < 10_000) {
        await new Promise((r) => setTimeout(r, 100));
      }
      const minSeen = Math.min(...seen());
      Object.assign(result, { presenceMinSeen: minSeen, presenceMs: Math.round(performance.now() - start) });
      await annotate(`setiap user melihat minimal ${minSeen}/${users} user online (${result.presenceMs} ms)`);
      expect(minSeen, "user online yang terlihat").toBe(users);
    });

    test("ketikan satu user muncul di layar semua user lain", async ({ annotate }) => {
      const [writer, ...readers] = clients;
      const delays: number[] = [];
      let missed = 0;
      for (let round = 0; round < 5; round++) {
        const marker = `[ketikan-${round}]`;
        const arrived = Promise.all(
          readers.map((r) => waitFor([r.doc], () => r.text.toString().includes(marker), 10_000)),
        );
        writer.text.insert(writer.text.length, marker);
        for (const ms of await arrived) {
          if (ms === null) missed++;
          else delays.push(ms);
        }
      }
      Object.assign(result, {
        propagateP50: percentile(delays, 50),
        propagateP95: percentile(delays, 95),
        propagateMax: Math.max(...delays),
        propagateMissed: missed,
      });
      await annotate(`5 ketikan x ${readers.length} penerima: p50=${result.propagateP50} ms, p95=${result.propagateP95} ms, maks=${result.propagateMax} ms, tidak sampai=${missed}`);
      expect(missed, "ketikan yang tidak sampai").toBe(0);
      expect(result.propagateP95 as number, `p95 waktu ketikan sampai (target ${TARGET.propagateMs} ms)`).toBeLessThanOrEqual(TARGET.propagateMs);
    });

    test("semua user mengetik bersamaan, hasil akhirnya sama", async ({ annotate }) => {
      const markers = clients.map((_, i) => `<user-${i + 1}>`);
      const allHaveAll = () => clients.every((c) => markers.every((m) => c.text.toString().includes(m)));
      const converged = waitFor(clients.map((c) => c.doc), allHaveAll, 15_000);
      clients.forEach((c, i) => c.text.insert(c.text.length, markers[i]));
      const ms = await converged;
      const identical = new Set(clients.map((c) => c.text.toString())).size === 1;
      Object.assign(result, { convergeMs: ms, identical });
      await annotate(ms === null ? "tidak sinkron dalam 15 detik" : `semua sinkron dalam ${ms} ms, isi identik: ${identical ? "ya" : "tidak"}`);
      expect(ms, "semua ketikan sampai ke semua user").not.toBeNull();
      expect(identical, "isi naskah di semua user identik").toBe(true);
      expect(ms!, `waktu sampai semua sinkron (target ${TARGET.convergeMs} ms)`).toBeLessThanOrEqual(TARGET.convergeMs);
    });
  });
}

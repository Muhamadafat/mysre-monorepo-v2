/**
 * Shared Daftar Pustaka over the real PartyKit server: two writers in one
 * fresh test room ("uji-pustaka-*", never a real draft) cite, edit and remove
 * references; both must end with the same list and the same numbers.
 * Needs `npm run dev:party` running.
 */
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import * as Y from "yjs";
import YPartyKitProvider from "y-partykit/provider";
import { afterAll, expect, test } from "vitest";
import { SharedBibliography } from "@/lib/sharedBibliography";

const PARTY_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "127.0.0.1:1999";
type Entry = { id: string; number: number; title: string; author: string; year: string; sourceId?: string };
const providers: YPartyKitProvider[] = [];

function join(room: string): Promise<SharedBibliography<Entry>> {
  const doc = new Y.Doc();
  const provider = new YPartyKitProvider(PARTY_HOST, room, doc, { WebSocketPolyfill: WebSocket as never });
  providers.push(provider);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("PartyKit tidak menjawab (jalankan npm run dev:party)")), 15_000);
    provider.on("sync", (ok: boolean) => {
      if (!ok) return;
      clearTimeout(timer);
      resolve(new SharedBibliography<Entry>(doc.getMap("bibliography")));
    });
  });
}

/** Waits until `check` holds (updates travel through the server). */
async function until(check: () => boolean, ms = 5000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error("tidak tersinkron dalam waktu");
    await new Promise((r) => setTimeout(r, 25));
  }
}

const entry = (id: string, number: number, title: string): Entry => ({ id, number, title, author: "Rahman, A.", year: "2023", sourceId: `art-${id}` });

afterAll(() => providers.forEach((p) => p.destroy()));

test("dua penulis: kutip, edit, hapus — Daftar Pustaka sama dan nomornya tetap", async () => {
  const room = `uji-pustaka-${randomUUID().slice(0, 8)}`;
  const A = await join(room);
  const B = await join(room);
  let listA = A.seed([]);
  let listB = B.seed([]);
  A.onChange((l) => (listA = l));
  B.onChange((l) => (listB = l));

  // A cites [1]; B sees it with the same number.
  listA = [entry("e1", 1, "Website design")];
  A.pushLocal(listA);
  await until(() => listB.length === 1);
  expect(listB).toEqual(listA);

  // Both cite at once from lists that don't know the other's new entry.
  listA = [...listA, entry("e2", 2, "Solar energy")];
  listB = [...listB, entry("e3", 3, "Deep learning")];
  A.pushLocal(listA);
  B.pushLocal(listB);
  await until(() => listA.length === 3 && listB.length === 3);
  expect(listA.map((e) => [e.id, e.number])).toEqual([["e1", 1], ["e2", 2], ["e3", 3]]);
  expect(listB).toEqual(listA);

  // B edits the details of [2] (Edit referensi): number unchanged on both.
  listB = listB.map((e) => (e.id === "e2" ? { ...e, title: "Solar energy (judul diperbaiki)" } : e));
  B.pushLocal(listB);
  await until(() => listA.find((e) => e.id === "e2")?.title === "Solar energy (judul diperbaiki)");
  expect(listA.find((e) => e.id === "e2")?.number).toBe(2);

  // A removes citation [1] from the text → entry removed for both.
  await new Promise((r) => setTimeout(r, 5200)); // past the grace for just-arrived entries
  listA = listA.filter((e) => e.id !== "e1");
  A.pushLocal(listA);
  await until(() => listB.length === 2);
  expect(listB.map((e) => e.number)).toEqual([2, 3]);
  expect(A.duplicateNumbers()).toEqual([]);
}, 60_000);

import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { SharedBibliography } from "./sharedBibliography";

type Entry = { id: string; number: number; title: string; createdAt?: Date | string };

/** Two browsers on one draft; updates are delivered only when flush() is called. */
function twoBrowsers() {
  const a = new Y.Doc();
  const b = new Y.Doc();
  const queue: { to: Y.Doc; update: Uint8Array }[] = [];
  a.on("update", (u: Uint8Array, origin: unknown) => origin !== "remote" && queue.push({ to: b, update: u }));
  b.on("update", (u: Uint8Array, origin: unknown) => origin !== "remote" && queue.push({ to: a, update: u }));
  const flush = () => {
    while (queue.length) {
      const { to, update } = queue.shift()!;
      Y.applyUpdate(to, update, "remote");
    }
  };
  let clock = 100_000;
  const now = () => clock;
  const A = new SharedBibliography<Entry>(a.getMap("bibliography"), now);
  const B = new SharedBibliography<Entry>(b.getMap("bibliography"), now);
  const seenByB: Entry[][] = [];
  B.onChange((list) => seenByB.push(list));
  return { A, B, flush, seenByB, tick: (ms: number) => (clock += ms) };
}

const e = (id: string, number: number, title = id): Entry => ({ id, number, title });

describe("SharedBibliography", () => {
  it("a citation added in one browser appears in the other with the same number", () => {
    const { A, B, flush, seenByB } = twoBrowsers();
    A.seed([]);
    B.seed([]);
    A.pushLocal([e("x", 1, "Website design")]);
    flush();
    expect(B.read()).toEqual([e("x", 1, "Website design")]);
    expect(seenByB.at(-1)).toEqual([e("x", 1, "Website design")]);
  });

  it("an out-of-date local list never wipes what the other browser added", () => {
    const { A, B, flush } = twoBrowsers();
    A.seed([]);
    B.seed([]);
    A.pushLocal([e("x", 1)]);
    B.pushLocal([e("y", 2)]); // B hasn't received x yet
    flush();
    expect(A.read().map((x) => x.id)).toEqual(["x", "y"]);
    expect(B.read().map((x) => x.id)).toEqual(["x", "y"]);
  });

  it("removing a citation removes it everywhere; editing changes details only", () => {
    const { A, B, flush } = twoBrowsers();
    A.seed([e("x", 1), e("y", 2)]);
    flush();
    B.seed([]);
    B.pushLocal([e("x", 1, "Judul diperbaiki"), e("y", 2)]);
    flush();
    expect(A.read()).toEqual([e("x", 1, "Judul diperbaiki"), e("y", 2)]);
    A.pushLocal([e("x", 1, "Judul diperbaiki")]);
    flush();
    expect(B.read()).toEqual([e("x", 1, "Judul diperbaiki")]);
  });

  it("does not delete an entry that just arrived (the list may not have caught up)", () => {
    const { A, B, flush, tick } = twoBrowsers();
    A.seed([]);
    B.seed([]);
    A.pushLocal([e("x", 1)]);
    flush();
    // B pushes a list computed before x arrived: x must survive, and B is
    // handed the shared list back to show.
    expect(B.pushLocal([])).toEqual([e("x", 1)]);
    flush();
    expect(A.read().map((x) => x.id)).toEqual(["x"]);
    // Later, a real removal by B does go through.
    tick(6000);
    B.pushLocal([]);
    flush();
    expect(A.read()).toEqual([]);
  });

  it("seeding keeps the shared numbers: a local entry never takes over a used number", () => {
    const { A, B, flush } = twoBrowsers();
    A.seed([e("x", 1, "Shared")]);
    flush();
    const merged = B.seed([e("old", 1, "Lokal lama"), e("z", 2, "Lokal unik")]);
    expect(merged).toEqual([e("x", 1, "Shared"), e("z", 2, "Lokal unik")]);
    flush();
    expect(A.read()).toEqual(merged);
  });

  it("stores plain JSON (dates become strings) and spots double-used numbers", () => {
    const { A, B, flush } = twoBrowsers();
    A.seed([]);
    B.seed([]);
    A.pushLocal([{ id: "x", number: 3, title: "a", createdAt: new Date("2026-11-24T00:00:00Z") }]);
    B.pushLocal([e("y", 3)]); // cited at the same moment
    flush();
    expect(A.read()[0].createdAt ?? A.read()[1].createdAt).toBe("2026-11-24T00:00:00.000Z");
    expect(A.duplicateNumbers()).toEqual([3]);
  });

  it("pushing the list it just received sends nothing back", () => {
    const doc = new Y.Doc();
    const shared = new SharedBibliography<Entry>(doc.getMap("bibliography"));
    shared.seed([e("x", 1)]);
    let updates = 0;
    doc.on("update", () => updates++);
    shared.pushLocal(shared.read());
    expect(updates).toBe(0);
  });
});

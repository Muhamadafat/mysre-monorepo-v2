import type * as Y from "yjs";

/**
 * Daftar Pustaka shared by everyone editing one draft.
 *
 * Before, each browser kept its own list (localStorage), so when one writer
 * cited "[4]" the others saw "[4]" in the shared text but had no entry 4 in
 * their Daftar Pustaka. Now the entries live in the shared Yjs doc, map
 * "bibliography", one key per entry id, so concurrent changes merge per
 * entry instead of one browser's whole list overwriting another's.
 *
 * The page keeps its React list; this class mirrors it both ways:
 * - pushLocal(list): what changed locally since the last mirror → the map
 *   (only those entries: an out-of-date local list can't wipe what others
 *   added, because entries it never knew about aren't in the diff).
 * - remote changes → onChange(list) for the page to show.
 *
 * Citation safety: an entry's `number` is what "[n]" in the text points at.
 * Nothing here renumbers; a number already used by another entry is never
 * taken over when seeding.
 */

export interface SharedBibEntry {
  id: string;
  number: number;
}

/** Remote entries younger than this aren't deleted by a local list that may not have caught up yet. */
const REMOTE_GRACE_MS = 5000;

/** JSON-safe copy (Dates → strings), as Yjs stores plain JSON values. */
const plain = <T,>(entry: T): T => JSON.parse(JSON.stringify(entry)) as T;
const key = (entry: unknown) => JSON.stringify(entry);

export class SharedBibliography<T extends SharedBibEntry> {
  /** id → JSON of the entry as last mirrored (both directions). */
  private synced = new Map<string, string>();
  /** id → time a remote change to it arrived. */
  private arrived = new Map<string, number>();
  private listeners = new Set<(list: T[]) => void>();
  private observer: (event: Y.YMapEvent<unknown>, tx: Y.Transaction) => void;

  constructor(
    private readonly map: Y.Map<unknown>,
    private readonly now: () => number = Date.now
  ) {
    this.observer = (event, tx) => {
      if (tx.local) return;
      const at = this.now();
      event.keysChanged.forEach((id) => this.arrived.set(id, at));
      const list = this.read();
      this.snapshot(list);
      this.listeners.forEach((fn) => fn(list));
    };
    map.observe(this.observer);
  }

  /** Current shared list, ordered by citation number. */
  read(): T[] {
    return [...this.map.values()]
      .filter((v): v is T => !!v && typeof v === "object" && typeof (v as T).id === "string")
      .sort((a, b) => a.number - b.number);
  }

  /**
   * First attach: adds this browser's entries the shared list doesn't have
   * (by id), skipping any whose number is already used there — the shared
   * one is what the shared text's "[n]" means. Returns the merged list.
   */
  seed(local: T[]): T[] {
    const shared = this.read();
    const ids = new Set(shared.map((e) => e.id));
    const numbers = new Set(shared.map((e) => e.number));
    const add = local.filter((e) => !ids.has(e.id) && !numbers.has(e.number));
    if (add.length) {
      this.map.doc?.transact(() => add.forEach((e) => this.map.set(e.id, plain(e))));
      if (!this.map.doc) add.forEach((e) => this.map.set(e.id, plain(e)));
    }
    const list = this.read();
    this.snapshot(list);
    return list;
  }

  /**
   * Local list → shared map (only what changed since the last mirror).
   * Returns the shared list when the local one can't be taken as is (an entry
   * that just arrived from a collaborator was missing from it), else null.
   */
  pushLocal(list: T[]): T[] | null {
    const now = this.now();
    const sets: T[] = [];
    const seen = new Set<string>();
    for (const entry of list) {
      seen.add(entry.id);
      const copy = plain(entry);
      if (this.synced.get(entry.id) !== key(copy)) sets.push(copy);
    }
    const gone = [...this.synced.keys()].filter((id) => !seen.has(id) && this.map.has(id));
    const deletes = gone.filter((id) => now - (this.arrived.get(id) ?? 0) > REMOTE_GRACE_MS);
    const kept = gone.length !== deletes.length;
    if (!sets.length && !deletes.length) return kept ? this.read() : null;
    const apply = () => {
      sets.forEach((e) => this.map.set(e.id, e));
      deletes.forEach((id) => this.map.delete(id));
    };
    if (this.map.doc) this.map.doc.transact(apply);
    else apply();
    sets.forEach((e) => this.synced.set(e.id, key(e)));
    deletes.forEach((id) => this.synced.delete(id));
    return kept ? this.read() : null;
  }

  /** Numbers used by more than one entry (two writers citing at the same moment). */
  duplicateNumbers(): number[] {
    const count = new Map<number, number>();
    this.read().forEach((e) => count.set(e.number, (count.get(e.number) ?? 0) + 1));
    return [...count].filter(([, n]) => n > 1).map(([num]) => num);
  }

  onChange(fn: (list: T[]) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  destroy(): void {
    this.map.unobserve(this.observer);
    this.listeners.clear();
  }

  private snapshot(list: T[]) {
    this.synced = new Map(list.map((e) => [e.id, key(plain(e))]));
  }
}

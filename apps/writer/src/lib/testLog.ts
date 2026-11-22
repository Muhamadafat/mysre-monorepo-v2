"use client";

/**
 * In-browser log for manual (use-case) testing of the draft editor, shown in
 * components/TestLogPanel.tsx. Every AI call, voice session, save and
 * collaboration status change the tester triggers lands here with its
 * duration and outcome, so a test run can be read off the screen and
 * downloaded as CSV — the server-side counterpart is logs/ai-latency.jsonl.
 *
 * Network calls are captured by wrapping window.fetch while the panel is
 * mounted (CopilotPlugin and the voice assistant call fetch directly, so
 * there is no single call site to instrument). Entries are kept in
 * localStorage so a page reload in the middle of a test keeps the log.
 */

export type TestLogStatus = "ok" | "kosong" | "gagal" | "dibatalkan" | "info";

export type TestLogEntry = {
  id: number;
  /** ISO time the action started. */
  ts: string;
  /** Feature label, e.g. "Autocomplete", "AI: continue", "Kolaborasi". */
  feature: string;
  status: TestLogStatus;
  /** Round trip as the user experiences it (browser → server → browser). */
  durationMs?: number;
  httpStatus?: number;
  detail?: string;
};

const STORAGE_KEY = "writer-test-log";
const MAX_ENTRIES = 500;

let entries: TestLogEntry[] = load();
let nextId = entries.reduce((max, e) => Math.max(max, e.id), 0) + 1;
const listeners = new Set<() => void>();

function load(): TestLogEntry[] {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full or blocked: the on-screen log still works.
  }
}

function emit() {
  persist();
  listeners.forEach((listener) => listener());
}

/**
 * The "Log Uji" panel is for testing only: always on in dev; in production
 * only when the deploy sets NEXT_PUBLIC_TEST_LOG=on AND the URL has ?log.
 * When off, nothing is recorded (not even to localStorage).
 */
export function testLogEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.NEXT_PUBLIC_TEST_LOG === "on" && new URLSearchParams(window.location.search).has("log");
}

export function pushTestLog(entry: Omit<TestLogEntry, "id" | "ts"> & { ts?: string }) {
  if (!testLogEnabled()) return;
  entries = [...entries, { id: nextId++, ts: entry.ts ?? new Date().toISOString(), ...entry }].slice(-MAX_ENTRIES);
  emit();
}

export function clearTestLog() {
  entries = [];
  emit();
}

export const getTestLog = () => entries;

export function subscribeTestLog(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const short = (text: string, max = 80) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
};

/**
 * Which requests are logged and how their outcome is read. `feature` gets
 * the parsed request body; `describe` the parsed JSON response.
 */
const TRACKED: {
  match: (url: string, method: string) => boolean;
  feature: (body: any) => string;
  describe?: (data: any) => { status: TestLogStatus; detail: string };
}[] = [
  {
    match: (url) => url.startsWith("/api/copilot"),
    feature: () => "Autocomplete",
    // The route answers " " when the model had no suggestion.
    describe: (data) =>
      data?.text?.trim()
        ? { status: "ok", detail: `saran: "${short(data.text, 60)}"` }
        : { status: "kosong", detail: "tidak ada saran" },
  },
  {
    match: (url) => url.startsWith("/api/chat"),
    feature: (body) => (body?.writer?.mode ? `AI: ${body.writer.mode}` : "AI: chat"),
    describe: (data) => {
      const answer = typeof data?.answer === "string" ? data.answer : "";
      return answer.trim()
        ? { status: "ok", detail: `${answer.length} karakter: "${short(answer, 60)}"` }
        : { status: "kosong", detail: "jawaban kosong" };
    },
  },
  {
    match: (url) => url.startsWith("/api/voice/session"),
    feature: () => "Suara: mulai sesi",
    describe: () => ({ status: "ok", detail: "sesi suara dibuat" }),
  },
  {
    match: (url, method) => url.startsWith("/api/draft/save") && method === "POST",
    feature: () => "Simpan draft",
    describe: () => ({ status: "ok", detail: "tersimpan" }),
  },
];

function requestUrl(input: RequestInfo | URL): string {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  try {
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin ? url.pathname + url.search : raw;
  } catch {
    return raw;
  }
}

/** Wraps window.fetch to log the tracked requests; returns the undo. */
export function installFetchLogger(): () => void {
  const original = window.fetch;

  const logged: typeof window.fetch = async (input, init) => {
    const url = requestUrl(input);
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const tracked = TRACKED.find((t) => t.match(url, method));
    if (!tracked) return original(input, init);

    let body: any = null;
    try {
      body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    } catch {
      // Not JSON; the feature label falls back to its default.
    }
    const feature = tracked.feature(body);
    const ts = new Date().toISOString();
    const start = performance.now();
    const elapsed = () => Math.round(performance.now() - start);

    try {
      const response = await original(input, init);
      const durationMs = elapsed();
      // Read a copy so the caller still gets an unread body.
      response
        .clone()
        .json()
        .catch(() => null)
        .then((data) => {
          if (!response.ok) {
            pushTestLog({
              ts,
              feature,
              status: "gagal",
              durationMs,
              httpStatus: response.status,
              detail: short(data?.error || data?.message || response.statusText || "error"),
            });
            return;
          }
          const outcome = tracked.describe?.(data) ?? { status: "ok" as const, detail: "" };
          pushTestLog({ ts, feature, durationMs, httpStatus: response.status, ...outcome });
        });
      return response;
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      pushTestLog({
        ts,
        feature,
        status: aborted ? "dibatalkan" : "gagal",
        durationMs: elapsed(),
        detail: aborted ? "dibatalkan (pengguna lanjut mengetik)" : short(String(error)),
      });
      throw error;
    }
  };

  window.fetch = logged;
  return () => {
    if (window.fetch === logged) window.fetch = original;
  };
}

/** Percentile (0–100) of a list of numbers, nearest-rank. */
export function percentile(values: number[], p: number): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

/**
 * CSV for Excel in an Indonesian locale: ";" as separator (Excel there
 * splits on ";", so "," put every row in one column), rows in time order,
 * local time instead of UTC ISO, renumbered from 1.
 */
export function testLogToCsv(list: TestLogEntry[]): string {
  const cell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const localTime = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  const rows = [...list]
    .sort((a, b) => a.ts.localeCompare(b.ts))
    .map((e, i) =>
      [i + 1, localTime(e.ts), e.feature, e.status, e.durationMs, e.httpStatus, e.detail].map(cell).join(";"),
    );
  return ["No;Waktu;Fitur;Status;Durasi (ms);HTTP;Keterangan", ...rows].join("\r\n");
}

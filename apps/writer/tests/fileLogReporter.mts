import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Reporter, TestModule } from "vitest/node";

/**
 * Vitest reporter that saves every run as a readable log file:
 * logs/<name>-<date>_<time>.log, one line per test (status, duration, name,
 * and whatever the test recorded with `annotate`, e.g. an AI latency),
 * followed by failures and a summary. Every run gets its own file, so runs
 * from different days can be compared.
 */
export default class FileLogReporter implements Reporter {
  constructor(private readonly name: string) {}

  onTestRunEnd(testModules: ReadonlyArray<TestModule>) {
    const started = new Date();
    const lines: string[] = [];
    const failures: string[] = [];
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (const testModule of testModules) {
      lines.push("", `## ${testModule.relativeModuleId}`);
      for (const test of testModule.children.allTests()) {
        const state = test.result().state;
        const ms = Math.round(test.diagnostic()?.duration ?? 0);
        const notes = test.annotations().map((a) => a.message).join(" | ");
        const mark = state === "passed" ? "LULUS " : state === "failed" ? "GAGAL " : "LEWATI";
        lines.push(`${mark} ${String(ms).padStart(6)} ms  ${test.fullName}${notes ? `  -> ${notes}` : ""}`);

        if (state === "passed") passed++;
        else if (state === "failed") {
          failed++;
          const result = test.result();
          const message = result.state === "failed" ? result.errors.map((e) => e.message).join("\n    ") : "";
          failures.push(`- ${test.fullName}\n    ${message}`);
        } else skipped++;
      }
    }

    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp =
      `${started.getFullYear()}-${pad(started.getMonth() + 1)}-${pad(started.getDate())}` +
      `_${pad(started.getHours())}-${pad(started.getMinutes())}-${pad(started.getSeconds())}`;
    const file = path.join(process.cwd(), "logs", `${this.name}-${stamp}.log`);
    const header = [
      `Laporan ${this.name}`,
      `Waktu   : ${started.toLocaleString("id-ID")}`,
      `Hasil   : ${passed} lulus, ${failed} gagal, ${skipped} dilewati (total ${passed + failed + skipped})`,
    ];
    const body = [...header, ...lines, ...(failures.length ? ["", "## Yang gagal", ...failures] : [])];

    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, body.join("\n") + "\n");
    console.log(`\nLog tersimpan: ${file}`);
  }
}

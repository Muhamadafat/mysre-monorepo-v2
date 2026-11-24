import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import FileLogReporter from "./tests/fileLogReporter.mts";

// Collaboration tests: who may open a draft (real database, read-only) and
// how many users can edit one draft at once (real PartyKit server, in
// separate test rooms so no real draft is touched). Needs Postgres, the
// writer dev server and `npm run dev:party` running.
// `npm run test:collab` — log in logs/collab-test-<date>_<time>.log
export default defineConfig(({ mode }) => ({
  // tests/ is excluded from tsconfig (keeps it out of `next build`), so the
  // "@/" path alias doesn't reach the files in it: spell it out here.
  resolve: { tsconfigPaths: true, alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/collab/**/*.test.ts"],
    env: loadEnv(mode, process.cwd(), ""),
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    reporters: ["verbose", new FileLogReporter("collab-test")],
  },
}));

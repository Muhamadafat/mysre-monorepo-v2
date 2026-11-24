import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import FileLogReporter from "./tests/fileLogReporter.mts";

// Referensi Pustaka CRUD on the real database (own throw-away project,
// cleaned up afterwards). Needs Postgres only, no server.
// `npm run test:references` — log in logs/references-test-<date>_<time>.log
export default defineConfig(({ mode }) => ({
  // tests/ is excluded from tsconfig (keeps it out of `next build`), so the
  // "@/" path alias doesn't reach the files in it: spell it out here.
  resolve: { tsconfigPaths: true, alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/references/**/*.test.ts"],
    env: loadEnv(mode, process.cwd(), ""),
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    reporters: ["verbose", new FileLogReporter("references-test")],
  },
}));

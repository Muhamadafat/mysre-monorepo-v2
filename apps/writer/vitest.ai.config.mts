import { defineConfig } from "vitest/config";
import FileLogReporter from "./tests/fileLogReporter.mts";

// Reliability tests against the real AI (mcp-sre must be running; it uses
// the lecturer's key). Latencies vary from run to run, so these check
// thresholds, not exact values.
// `npm run test:ai` — log in logs/ai-test-<date>_<time>.log
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/ai/**/*.test.ts"],
    testTimeout: 120_000,
    fileParallelism: false,
    reporters: ["verbose", new FileLogReporter("ai-test")],
  },
});

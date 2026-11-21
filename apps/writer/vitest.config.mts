import { defineConfig } from "vitest/config";
import FileLogReporter from "./tests/fileLogReporter.mts";

// Unit tests: pure logic, no servers or AI needed, same result every run.
// `npm run test` — log in logs/unit-test-<date>_<time>.log
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    reporters: ["verbose", new FileLogReporter("unit-test")],
  },
});

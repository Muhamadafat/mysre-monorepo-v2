import { defineConfig } from "vitest/config";

// S3 → Postgres sync of the voice recordings + checks on the rows
// (tests/voicedb). Touches the real bucket and database.
// `npm run voice:db-sync`
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/voicedb/**/*.test.ts"],
    testTimeout: 120_000,
    reporters: ["verbose"],
  },
});

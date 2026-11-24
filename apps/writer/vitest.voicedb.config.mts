import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// S3 → Postgres sync of the voice recordings + checks on the rows
// (tests/voicedb). Touches the real bucket and database.
// `npm run voice:db-sync`
export default defineConfig({
  // tests/ is excluded from tsconfig (keeps it out of `next build`), so the
  // "@/" path alias doesn't reach the files in it: spell it out here.
  resolve: { tsconfigPaths: true, alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/voicedb/**/*.test.ts"],
    testTimeout: 120_000,
    reporters: ["verbose"],
  },
});

import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    /* the embedded test Postgres (scripts/local-postgres.ts, port 5434) */
    env: { DATABASE_URL: "postgresql://postgres:postgres@localhost:5434/crm" },
    globalSetup: "./src/tests/global-setup.ts",
    /* Integration tests share one database — keep files sequential. */
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000, // first run downloads/initialises embedded Postgres
  },
});

import { defineConfig } from "vitest/config";

/* per-run test-Postgres port — a zombie socket on a fixed port must never block runs */
const TEST_PG_PORT = 5900 + (process.pid % 400);
process.env.TEST_PG_PORT = String(TEST_PG_PORT);
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    /* the embedded test Postgres (scripts/local-postgres.ts, port 5434) */
    env: { DATABASE_URL: `postgresql://postgres:postgres@localhost:${TEST_PG_PORT}/crm` },
    globalSetup: "./src/tests/global-setup.ts",
    /* Integration tests share one database — keep files sequential. */
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000, // first run downloads/initialises embedded Postgres
  },
});

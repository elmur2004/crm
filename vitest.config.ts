import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    env: { DATABASE_URL: "file:./test.db" },
    globalSetup: "./src/tests/global-setup.ts",
    /* Integration tests share one SQLite file — keep files sequential. */
    fileParallelism: false,
    testTimeout: 30_000, // SQLite-on-Windows transaction I/O
    hookTimeout: 30_000,
  },
});

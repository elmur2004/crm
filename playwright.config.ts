import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  /* Journeys share one seeded DB and build on absolute dashboard numbers —
     strictly serial. */
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    /* Production server: Next 16 allows only ONE dev server per project, and the
       founder's dev instance may be running. `next build` writes .next (dev uses
       .next/dev — no clash). */
    command: "npx next build && npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 300_000,
    env: { DATABASE_URL: "file:./e2e.db" },
  },
});

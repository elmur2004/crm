import { defineConfig } from "@playwright/test";

/* The e2e Postgres port is PER-RUN (pid-derived): a crashed run can leave a
   Windows zombie socket on a fixed port, which would block every later run.
   The config, the globalSetup (same process), and the webServer child all see
   the same value via E2E_PG_PORT. */
const E2E_PG_PORT = 5500 + (process.pid % 400);
process.env.E2E_PG_PORT = String(E2E_PG_PORT);

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
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
       .next/dev — no clash). build + boot need NO database (force-dynamic pages);
       global-setup owns the embedded e2e Postgres + migrate + seed. */
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 300_000,
    env: { DATABASE_URL: `postgresql://postgres:postgres@localhost:${E2E_PG_PORT}/crm` },
  },
});

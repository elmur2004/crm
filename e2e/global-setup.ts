import { execSync } from "node:child_process";
import { startLocalPostgres, urlFor } from "../scripts/local-postgres";

/* Playwright global setup: boot a FRESH embedded Postgres (port 5435), migrate,
   reset + seed. The webServer (which Playwright may boot in parallel) never
   touches the database until the tests fire requests, by which point this has
   completed. global-teardown stops the server. */

const E2E_PORT = 5435;

export default async function globalSetup() {
  const pg = await startLocalPostgres({ name: "e2e", port: E2E_PORT, fresh: true });
  (globalThis as Record<string, unknown>).__e2ePg = pg;
  const env = { ...process.env, DATABASE_URL: urlFor(E2E_PORT) };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
  execSync("npx tsx e2e/setup-db.ts", { env, stdio: "pipe" });
}

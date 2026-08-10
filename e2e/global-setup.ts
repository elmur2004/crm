import { execSync } from "node:child_process";
import { pruneStaleDirs, startLocalPostgres, urlFor } from "../scripts/local-postgres";

/* Playwright global setup: boot a FRESH embedded Postgres (port 5435), migrate,
   reset + seed. The webServer (which Playwright may boot in parallel) never
   touches the database until the tests fire requests, by which point this has
   completed. global-teardown stops the server. A UNIQUE data dir per run keeps
   a crashed previous run's orphan (which pins its shared-memory key to the old
   path) from blocking initdb. */

export default async function globalSetup() {
  const E2E_PORT = Number(process.env.E2E_PG_PORT ?? 5435); // set by playwright.config
  await pruneStaleDirs("e2e");
  const pg = await startLocalPostgres({ name: `e2e-${process.pid}`, port: E2E_PORT, fresh: true });
  (globalThis as Record<string, unknown>).__e2ePg = pg;
  const env = { ...process.env, DATABASE_URL: urlFor(E2E_PORT) };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
  execSync("npx tsx e2e/setup-db.ts", { env, stdio: "pipe" });
}

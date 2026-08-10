import { execSync } from "node:child_process";
import { pruneStaleDirs, startLocalPostgres, urlFor } from "../../scripts/local-postgres";

/* Integration tests run against a FRESH embedded Postgres per run (port 5434,
   wired via vitest env). Migrations apply once; each test file resets the
   tables it touches. The returned teardown stops the server. A UNIQUE data dir
   per run sidesteps a crashed run's orphaned shared-memory block. */

export default async function setup() {
  await pruneStaleDirs("test");
  const port = Number(process.env.TEST_PG_PORT ?? 5434); // set by vitest.config
  const pg = await startLocalPostgres({ name: `test-${process.pid}`, port, fresh: true });
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: urlFor(port) },
    stdio: "pipe",
  });
  return async () => {
    await pg.stop().catch(() => undefined);
  };
}

import { execSync } from "node:child_process";
import { startLocalPostgres, urlFor } from "../../scripts/local-postgres";

/* Integration tests run against a FRESH embedded Postgres per run (port 5434,
   wired via vitest env). Migrations apply once; each test file resets the
   tables it touches. The returned teardown stops the server. */

export default async function setup() {
  const pg = await startLocalPostgres({ name: "test", port: 5434, fresh: true });
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: urlFor(5434) },
    stdio: "pipe",
  });
  return async () => {
    await pg.stop().catch(() => undefined);
  };
}

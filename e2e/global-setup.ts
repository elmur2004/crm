import { execSync } from "node:child_process";

/* Playwright global setup: migrate + reset + seed the dedicated e2e database.
   The webServer (started by Playwright with the same DATABASE_URL) reads this file. */

export default function globalSetup() {
  const env = { ...process.env, DATABASE_URL: "file:./e2e.db" };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
  execSync("npx tsx e2e/setup-db.ts", { env, stdio: "pipe" });
}

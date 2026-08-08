import { execSync } from "node:child_process";

/* Integration tests run against a dedicated SQLite db (file:./test.db, wired via
   vitest env). Migrations are applied once per run; each test file resets the
   tables it touches. */

export default function setup() {
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "pipe",
  });
}

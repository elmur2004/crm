#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";

/* Production launcher (plain Node — no dev tooling needed):
   1. apply migrations, retrying while the database warms up;
   2. boot `next start` EVEN IF migrations failed — a crash-looping app
      (bad gateway) is strictly worse than a booted app whose sign-in
      surfaces the real database error. `next start` honors $PORT. */

const RETRIES = 3;
const RETRY_DELAY_MS = 4000;

function tryMigrate(attempt) {
  console.log(`[start] prisma migrate deploy (attempt ${attempt}/${RETRIES})`);
  const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return result.status === 0;
}

let migrated = false;
for (let attempt = 1; attempt <= RETRIES && !migrated; attempt++) {
  migrated = tryMigrate(attempt);
  if (!migrated && attempt < RETRIES) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }
}
if (!migrated) {
  console.error(
    "[start] MIGRATIONS FAILED after retries — booting anyway. " +
      "Check DATABASE_URL and run `npx prisma migrate deploy` manually.",
  );
}

const server = spawn("npx", ["next", "start"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("exit", (code) => process.exit(code ?? 0));

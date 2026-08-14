import EmbeddedPostgres from "embedded-postgres";
import { existsSync, readdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";

/* The cluster MUST be UTF8: this platform is bilingual (Arabic ⇄ English), so
   lead names, companies, and search queries carry Arabic. initdb on Windows
   otherwise inherits the OS locale and builds a WIN1252 cluster, where any
   Arabic byte raises 22P05 ("no equivalent in encoding WIN1252") on write AND
   on read. UTF8 needs a matching locale — C is the portable one. */
const INITDB_FLAGS = ["-E", "UTF8", "--locale=C"];

/* Local PostgreSQL without Docker (ADR-033): embedded-postgres downloads real
   PostgreSQL binaries into node_modules and runs them against a project-local
   data dir (.pgdata/<name>, gitignored). Three instances so dev, vitest and
   Playwright never collide:
     dev  → port 5433 (persistent — `npm run db:up`)
     test → port 5434 (fresh per vitest run)
     e2e  → port 5435 (fresh per Playwright run)
   Every instance serves one database named `crm` as postgres/postgres. */

export const PG_DB = "crm";

export function urlFor(port: number): string {
  return `postgresql://postgres:postgres@localhost:${port}/${PG_DB}`;
}

/** Best-effort cleanup of stale per-run data dirs (locked ones are skipped —
    a crashed run's orphan may still hold its files/shared memory, which is
    exactly why fresh instances use a UNIQUE dir per run). */
export async function pruneStaleDirs(prefix: string): Promise<void> {
  const root = path.resolve(process.cwd(), ".pgdata");
  if (!existsSync(root)) return;
  for (const entry of readdirSync(root)) {
    if (entry.startsWith(prefix)) {
      await rm(path.join(root, entry), { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

export async function startLocalPostgres(opts: {
  name: string;
  port: number;
  fresh?: boolean;
}): Promise<EmbeddedPostgres> {
  const databaseDir = path.resolve(process.cwd(), ".pgdata", opts.name);
  if (opts.fresh) {
    await rm(databaseDir, { recursive: true, force: true });
  }
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: "postgres",
    password: "postgres",
    port: opts.port,
    persistent: false, // we manage lifecycle explicitly
    initdbFlags: INITDB_FLAGS,
  });
  const preExisting = existsSync(path.join(databaseDir, "PG_VERSION"));
  if (!preExisting) {
    await pg.initialise();
  }
  await pg.start();
  await pg.createDatabase(PG_DB).catch(() => undefined); // exists on restarts
  /* A cluster created before the UTF8 fix keeps its old encoding — say so
     loudly instead of failing later on the first Arabic character. */
  if (preExisting) await warnIfNotUtf8(pg, databaseDir);
  return pg;
}

async function warnIfNotUtf8(pg: EmbeddedPostgres, databaseDir: string): Promise<void> {
  const client = pg.getPgClient(PG_DB);
  try {
    await client.connect();
    const { rows } = await client.query<{ server_encoding: string }>("SHOW server_encoding");
    const encoding = rows[0]?.server_encoding;
    if (encoding && encoding !== "UTF8") {
      console.warn(
        `[local-postgres] WARNING: ${databaseDir} is a ${encoding} cluster — Arabic text ` +
          `cannot be stored or searched there. Dump what you need, delete that folder, and ` +
          `start again to get a UTF8 cluster.`,
      );
    }
  } catch {
    /* diagnostics only — never block a start on it */
  } finally {
    await client.end().catch(() => undefined);
  }
}

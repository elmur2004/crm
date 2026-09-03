import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { BOOTSTRAP_ADMIN_EMAILS, ensureAdminExists } from "@/lib/services/bootstrap";
import { storage, uploadsDir, uploadsDirConfigured } from "@/lib/storage";

/* Production self-diagnostic (founder: "the login problem remains").
   GET /api/health answers, in one place: is the database reachable, is the
   schema migrated, does the admin exist (it HEALS the admin while checking),
   is the auth environment sane, and what does the proxy forward. Booleans and
   hints only — no secrets. */

export const dynamic = "force-dynamic";

/* One migrate-deploy at a time; concurrent health hits wait on the same run. */
let migrateInFlight: Promise<{ ok: boolean; output: string }> | null = null;

function runMigrateDeploy(): Promise<{ ok: boolean; output: string }> {
  migrateInFlight ??= (async () => {
    try {
      const { spawnSync } = await import("node:child_process");
      const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
        encoding: "utf-8",
        shell: process.platform === "win32",
        timeout: 90_000,
      });
      const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
      return { ok: result.status === 0, output };
    } catch (e) {
      return { ok: false, output: e instanceof Error ? e.message : String(e) };
    } finally {
      migrateInFlight = null;
    }
  })();
  return migrateInFlight;
}

export async function GET(req: Request) {
  const hints: string[] = [];

  /* ---- environment ---- */
  const dbUrl = process.env.DATABASE_URL ?? "";
  const env = {
    nodeEnv: process.env.NODE_ENV ?? "(unset)",
    databaseUrlSet: Boolean(dbUrl),
    databaseUrlProtocolOk: dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://"),
    authSecretSet: Boolean(process.env.AUTH_SECRET),
    authUrl: process.env.AUTH_URL ?? "(unset)",
  };
  if (!env.databaseUrlSet) hints.push("Set DATABASE_URL (postgresql://user:pass@host:5432/db).");
  else if (!env.databaseUrlProtocolOk)
    hints.push("DATABASE_URL must start with postgresql:// — the app runs PostgreSQL.");
  if (!env.authSecretSet)
    hints.push("Set AUTH_SECRET (openssl rand -base64 32) — sign-in cannot work without it.");

  /* ---- what the proxy forwards (secure-cookie sanity) ---- */
  const proxy = {
    host: req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "(none)",
    proto: req.headers.get("x-forwarded-proto") ?? "(none)",
  };
  if (proxy.proto === "http")
    hints.push(
      "The proxy forwards x-forwarded-proto=http — if the site is served over https, session cookies will be dropped. Fix the proxy header or set AUTH_URL=https://your-domain.",
    );

  /* ---- database ---- */
  let dbReachable = false;
  let dbError: string | null = null;
  try {
    await db.$queryRaw`SELECT 1`;
    dbReachable = true;
  } catch (e) {
    dbError = e instanceof Error ? e.message.split("\n")[0]!.slice(0, 300) : String(e);
    hints.push("Database unreachable — check DATABASE_URL, network, and that Postgres is running.");
  }

  /* ---- schema (every COMMITTED migration must be applied) ----
     ADR-057: probing one column can only notice a migration that ADDS a column.
     A data-only migration (the agent stage rename) adds none, so the old probe
     returned true while agent cards sat on stages their board has no column
     for — stranded behind a green health check, with `scripts/start.mjs` happy
     to boot after three failed `migrate deploy` attempts. The probe now
     compares the committed migration folders against `_prisma_migrations`, so
     it is current for every migration, forever, with nothing to keep in sync. */
  let pendingMigrations: string[] = [];

  /** null = cannot tell (no migrations dir, or the table does not exist yet) —
      fall back to the column probe rather than crying wolf. */
  async function unappliedMigrations(): Promise<string[] | null> {
    try {
      const { readdir } = await import("node:fs/promises");
      const pathMod = await import("node:path");
      const entries = await readdir(pathMod.join(process.cwd(), "prisma", "migrations"), {
        withFileTypes: true,
      });
      const committed = entries.filter((e) => e.isDirectory()).map((e) => e.name);
      if (committed.length === 0) return null;
      const rows = await db.$queryRaw<Array<{ migration_name: string }>>`
        SELECT migration_name FROM "_prisma_migrations"
         WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
      const applied = new Set(rows.map((r) => r.migration_name));
      return committed.filter((name) => !applied.has(name)).sort();
    } catch {
      return null;
    }
  }

  async function schemaProbe(): Promise<boolean> {
    try {
      await db.user.findFirst({ select: { registrationStatus: true } });
    } catch {
      pendingMigrations = [];
      return false;
    }
    const unapplied = await unappliedMigrations();
    pendingMigrations = unapplied ?? [];
    return pendingMigrations.length === 0;
  }
  let schemaCurrent = false;
  let migrateRan: { ok: boolean; output: string } | null = null;
  if (dbReachable) {
    schemaCurrent = await schemaProbe();
    if (!schemaCurrent) {
      /* SELF-HEAL (founder rebuilt the DB): apply the committed migrations
         right here — same command the boot script runs. Idempotent; applies
         only migrations from prisma/migrations. */
      migrateRan = await runMigrateDeploy();
      schemaCurrent = await schemaProbe();
      if (schemaCurrent) {
        hints.push("Schema was missing — migrations were applied JUST NOW. Retry your sign-in.");
      } else {
        hints.push(
          `Schema is NOT migrated${pendingMigrations.length > 0 ? ` (pending: ${pendingMigrations.join(", ")})` : ""} and applying it here failed: ${migrateRan.output.slice(0, 300)} — check DATABASE_URL and the database user's CREATE permission, then restart the app.`,
        );
      }
    }
  }

  /* ---- the admins (heals while checking) ----

     ADR-074 — EVERY documented administrator, not just B-Systems'. This
     reported one hardcoded email, so after Mindoo got its own administrator the
     endpoint whose whole job is "why can I not sign in" could not answer the
     question for it.

     The list comes from the bootstrap itself, so this page also answers a
     question you cannot otherwise ask a deployment from outside: if
     admin@mindoo.com is not even NAMED in `admins` below, the server is running
     a build from before ADR-074 and needs redeploying — no amount of seeding
     will help. */
  type AdminReport = {
    email: string;
    exists: boolean;
    active?: boolean;
    status?: string;
    roles?: string[];
  };
  const admins: AdminReport[] = BOOTSTRAP_ADMIN_EMAILS.map((email) => ({ email, exists: false }));
  if (schemaCurrent) {
    await ensureAdminExists();
    for (const report of admins) {
      const found = await db.user.findUnique({
        where: { email: report.email },
        include: { roles: true },
      });
      if (found) {
        report.exists = true;
        report.active = found.active;
        report.status = found.registrationStatus;
        report.roles = found.roles.map((r) => r.role);
      } else {
        hints.push(
          `${report.email} is missing and could not be created — check the database user's write permissions.`,
        );
      }
    }
  }
  /* the original single-admin field, kept so anything reading it still works */
  const admin = admins.find((a) => a.email === "admin@byteforce.com") ?? { exists: false };

  /* ---- uploaded files (founder: "File missing from storage") ---- */
  const uploads: {
    dir: string;
    persistentDirConfigured: boolean;
    writable: boolean;
    attachments: number;
    missingFiles: number;
    missingSample: string[];
  } = {
    dir: uploadsDir(),
    persistentDirConfigured: uploadsDirConfigured(),
    writable: false,
    attachments: 0,
    missingFiles: 0,
    missingSample: [],
  };
  try {
    const probeKey = `${randomUUID().replace(/-/g, "")}.tmp`;
    await storage.put(probeKey, Buffer.from("health probe"));
    await storage.delete(probeKey);
    uploads.writable = true;
  } catch {
    hints.push(`Uploads directory is not writable (${uploads.dir}) — file uploads will fail.`);
  }
  if (schemaCurrent) {
    const attachments = await db.attachment.findMany({
      select: { storageKey: true },
      take: 500,
    });
    uploads.attachments = attachments.length;
    for (const a of attachments) {
      const present = (await storage.size(a.storageKey).catch(() => null)) !== null;
      if (!present) {
        uploads.missingFiles += 1;
        // opaque server-generated keys only — this endpoint is public, and real
        // filenames carry client/candidate names (/api/files gates them)
        if (uploads.missingSample.length < 5) uploads.missingSample.push(a.storageKey);
      }
    }
    if (uploads.missingFiles > 0) {
      hints.push(
        `${uploads.missingFiles} uploaded file(s) referenced in the database are MISSING from ${uploads.dir} — they were lost when the container was redeployed. Attach a persistent volume, set UPLOADS_DIR to its path, then re-upload the files (statements have a Re-upload proof button) or import a backup that contains them.`,
      );
    }
  }
  if (env.nodeEnv === "production" && !uploads.persistentDirConfigured) {
    hints.push(
      "UPLOADS_DIR is not set — uploads live INSIDE the container and every redeploy deletes them. Attach a persistent volume (e.g. mount it at /data/uploads) and set UPLOADS_DIR to that path.",
    );
  }

  const ok =
    env.databaseUrlSet &&
    env.databaseUrlProtocolOk &&
    env.authSecretSet &&
    dbReachable &&
    schemaCurrent &&
    admins.every((a) => a.exists && a.active === true && a.status === "approved") &&
    uploads.writable;
  if (ok && hints.length === 0) {
    hints.push(`All checks passed — sign in with ${admins.map((a) => a.email).join(" or ")}.`);
  }

  /* ADR-074 — WHICH BUILD IS THIS. A deployment that silently kept serving an
     older build is indistinguishable, from outside, from a broken database —
     and that ambiguity is what turned one missing account into three rounds of
     guessing. The `admins` array above already answers it structurally (an
     account this build cannot NAME is an account it cannot heal); the commit,
     when the host injects one, answers it exactly. */
  const build = {
    commit:
      process.env.RAILWAY_GIT_COMMIT_SHA ??
      process.env.RENDER_GIT_COMMIT ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.SOURCE_VERSION ??
      process.env.GIT_COMMIT ??
      null,
    knowsAdmins: BOOTSTRAP_ADMIN_EMAILS,
  };

  return Response.json(
    {
      ok,
      build,
      env,
      proxy,
      db: { reachable: dbReachable, error: dbError },
      schemaCurrent,
      pendingMigrations,
      admins,
      admin,
      uploads,
      hints,
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

import { db } from "@/lib/db";
import { ensureAdminExists } from "@/lib/services/bootstrap";

/* Production self-diagnostic (founder: "the login problem remains").
   GET /api/health answers, in one place: is the database reachable, is the
   schema migrated, does the admin exist (it HEALS the admin while checking),
   is the auth environment sane, and what does the proxy forward. Booleans and
   hints only — no secrets. */

export const dynamic = "force-dynamic";

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

  /* ---- schema (the newest column must exist) ---- */
  let schemaCurrent = false;
  if (dbReachable) {
    try {
      await db.user.findFirst({ select: { registrationStatus: true } });
      schemaCurrent = true;
    } catch {
      hints.push(
        "Schema is NOT migrated — run `npx prisma migrate deploy` in the container (the start script attempts this; check its [start] log lines).",
      );
    }
  }

  /* ---- the admin (heals while checking) ---- */
  let admin: { exists: boolean; active?: boolean; status?: string; roles?: string[] } = {
    exists: false,
  };
  if (schemaCurrent) {
    await ensureAdminExists();
    const found = await db.user.findUnique({
      where: { email: "admin@byteforce.com" },
      include: { roles: true },
    });
    if (found) {
      admin = {
        exists: true,
        active: found.active,
        status: found.registrationStatus,
        roles: found.roles.map((r) => r.role),
      };
    } else {
      hints.push("Admin missing and could not be created — check the database user's write permissions.");
    }
  }

  const ok =
    env.databaseUrlSet &&
    env.databaseUrlProtocolOk &&
    env.authSecretSet &&
    dbReachable &&
    schemaCurrent &&
    admin.exists &&
    admin.active === true &&
    admin.status === "approved";
  if (ok) hints.push("All checks passed — sign in with admin@byteforce.com.");

  return Response.json(
    { ok, env, proxy, db: { reachable: dbReachable, error: dbError }, schemaCurrent, admin, hints },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

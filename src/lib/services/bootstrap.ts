import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/hash";
import type { Role } from "@/lib/pipeline-engine/constants";

/* SELF-HEALING ADMINS (founder directive: the admin is admin@byteforce.com,
   named Elmur, both entities, identical in every environment — and its
   password is ALWAYS the documented one until deliberately changed).

   The password is PINNED: every check asserts the configured password and
   repairs the hash when it differs — exactly the seed's re-assert semantics,
   but at runtime, so an admin can never be locked out by a stale hash. To
   rotate: set the account's password env var (documented in README) — the pin
   then enforces the new value everywhere.

   ADR-074 — A TABLE, because there are TWO administrators now.

   This ran before every sign-in and knew about ONE account, which is how
   admin@byteforce.com exists in every environment WITHOUT the seed: the
   production launcher (scripts/start.mjs) runs `prisma migrate deploy` and
   never `prisma db seed`. So a seeded-only account reaches a local database and
   no other one, ever.

   The founder asked for Mindoo by credential — "I enter the creditials :
   admin@mindoo.com and password123" — which is the same kind of promise the
   ByteForce admin's directive was, and it needs the same mechanism to be true.
   Adding it to the seed alone made it true on a freshly seeded database and
   false everywhere else, which is exactly the report that sent us here. */

interface BootstrapAdmin {
  email: string;
  name: string;
  roles: readonly Role[];
  /** the env var that pins THIS account's password. Per-account on purpose:
      rotating one company's administrator must not silently change another
      company's. */
  passwordEnv: string;
  /** an older address to RENAME IN PLACE rather than duplicate — one admin,
      history intact. */
  legacyEmail?: string;
  fallbackPassword?: string;
}

const ADMINS: readonly BootstrapAdmin[] = [
  {
    email: "admin@byteforce.com",
    name: "Elmur",
    roles: ["bsystems_admin", "byteforce_staff"],
    passwordEnv: "ADMIN_PASSWORD",
    legacyEmail: "admin@b-systems.example",
  },
  /* ADR-074 — MINDOO'S OWN ADMINISTRATOR, its whole staff and the only way into
     /mindoo. One role: holding a B-Systems role too would put it in whichever
     app `landingFor` picked and give it a module switcher that crosses the wall
     the rest of ADR-074 builds. */
  {
    email: "admin@mindoo.com",
    name: "Mindoo Admin",
    roles: ["mindoo_staff"],
    passwordEnv: "MINDOO_ADMIN_PASSWORD",
  },
];

/* ADR-074 — the roles that belong to a DIFFERENT bootstrap administrator.

   These accounts must not overlap: that is the founder's "separate them
   entirely", and an account holding both apps lands in whichever one
   `landingFor` names. So each admin's own roles are asserted (upsert) and any
   role owned by ANOTHER bootstrap admin is revoked — narrowly, by name.

   Deliberately NOT "revoke everything not in the list": the founder may grant
   an admin an extra role from the Users screen, and silently undoing that on
   his next sign-in would be a worse surprise than the one this fixes. */
function foreignRoles(self: BootstrapAdmin): Role[] {
  const mine = new Set<Role>(self.roles);
  return ADMINS.filter((a) => a.email !== self.email)
    .flatMap((a) => a.roles)
    .filter((r) => !mine.has(r));
}

function passwordFor(admin: BootstrapAdmin): string {
  return process.env[admin.passwordEnv] || admin.fallbackPassword || "password123";
}

async function ensureRoles(admin: BootstrapAdmin, userId: string): Promise<void> {
  for (const role of admin.roles) {
    await db.userRole.upsert({
      where: { userId_role: { userId, role } },
      update: {},
      create: { userId, role },
    });
  }
  const foreign = foreignRoles(admin);
  if (foreign.length > 0) {
    await db.userRole.deleteMany({ where: { userId, role: { in: foreign } } });
  }
}

async function repair(
  admin: BootstrapAdmin,
  userId: string,
  currentHash: string,
  currentPlain: string | null,
  flagsBroken: boolean,
): Promise<void> {
  const password = passwordFor(admin);
  const passwordOk = await verifyPassword(password, currentHash);
  /* backfill the admin-visibility copy even when the hash already matches
     (accounts predating the column showed "—" forever otherwise) */
  const plainStale = currentPlain !== password;
  if (!passwordOk || flagsBroken || plainStale) {
    await db.user.update({
      where: { id: userId },
      data: {
        active: true,
        registrationStatus: "approved",
        passwordPlain: password,
        ...(passwordOk ? {} : { passwordHash: await hashPassword(password) }),
      },
    });
  }
  await ensureRoles(admin, userId);
}

async function ensureOne(admin: BootstrapAdmin): Promise<void> {
  const existing = await db.user.findUnique({ where: { email: admin.email } });
  if (existing) {
    await repair(
      admin,
      existing.id,
      existing.passwordHash,
      existing.passwordPlain,
      !existing.active || existing.registrationStatus !== "approved",
    );
    return;
  }

  if (admin.legacyEmail) {
    const legacy = await db.user.findUnique({ where: { email: admin.legacyEmail } });
    if (legacy) {
      /* rename in place — one admin, history intact — then pin */
      await db.user.update({
        where: { id: legacy.id },
        data: { email: admin.email, name: admin.name },
      });
      await repair(admin, legacy.id, legacy.passwordHash, legacy.passwordPlain, true);
      return;
    }
  }

  const password = passwordFor(admin);
  const created = await db.user.create({
    data: {
      name: admin.name,
      email: admin.email,
      passwordHash: await hashPassword(password),
      passwordPlain: password,
    },
  });
  await ensureRoles(admin, created.id);
  await db.activityLog.create({
    data: {
      entityType: "user",
      entityId: created.id,
      actorId: null,
      actorLabel: "System",
      action: "create",
      trigger: "admin_bootstrap",
    },
  });
}

/** Heals EVERY documented administrator before sign-in. Returns "ok" when they
    are guaranteed usable, "failed" when the database/schema prevented the check
    (the login page then points at /api/health instead of claiming wrong
    credentials).

    All-or-nothing on purpose: one company's administrator being healed while
    another's silently is not would produce precisely the report this exists to
    prevent — a documented credential that says "wrong password". */
export async function ensureAdminExists(): Promise<"ok" | "failed"> {
  try {
    for (const admin of ADMINS) await ensureOne(admin);
    return "ok";
  } catch {
    /* schema not migrated or DB unreachable — nothing cached; the next
       attempt heals the moment the database is ready */
    return "failed";
  }
}

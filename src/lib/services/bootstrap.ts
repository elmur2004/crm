import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/hash";

/* SELF-HEALING ADMIN (founder directive: the admin is admin@byteforce.com,
   named Elmur, both entities, identical in every environment — and its
   password is ALWAYS the documented one until deliberately changed).

   The password is PINNED: every check asserts the configured password
   (ADMIN_PASSWORD env, default "password123") and repairs the hash when it
   differs — exactly the seed's re-assert semantics, but at runtime, so the
   admin can never be locked out by a stale hash. To rotate: set the
   ADMIN_PASSWORD env var (documented in README) — the pin then enforces the
   new value everywhere. */

const ADMIN_EMAIL = "admin@byteforce.com";
const LEGACY_EMAIL = "admin@b-systems.example";
const ADMIN_NAME = "Elmur";
const ADMIN_ROLES = ["bsystems_admin", "byteforce_staff"] as const;

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || "password123";
}

async function ensureRoles(userId: string): Promise<void> {
  for (const role of ADMIN_ROLES) {
    await db.userRole.upsert({
      where: { userId_role: { userId, role } },
      update: {},
      create: { userId, role },
    });
  }
}

async function repair(userId: string, currentHash: string, flagsBroken: boolean): Promise<void> {
  const password = adminPassword();
  const passwordOk = await verifyPassword(password, currentHash);
  if (!passwordOk || flagsBroken) {
    await db.user.update({
      where: { id: userId },
      data: {
        active: true,
        registrationStatus: "approved",
        ...(passwordOk ? {} : { passwordHash: await hashPassword(password) }),
      },
    });
  }
  await ensureRoles(userId);
}

/** Heals the admin before sign-in. Returns "ok" when the admin is guaranteed
    usable, "failed" when the database/schema prevented the check (the login
    page then points at /api/health instead of claiming wrong credentials). */
export async function ensureAdminExists(): Promise<"ok" | "failed"> {
  try {
    const existing = await db.user.findUnique({ where: { email: ADMIN_EMAIL } });
    if (existing) {
      await repair(
        existing.id,
        existing.passwordHash,
        !existing.active || existing.registrationStatus !== "approved",
      );
      return "ok";
    }

    const legacy = await db.user.findUnique({ where: { email: LEGACY_EMAIL } });
    if (legacy) {
      /* rename in place — one admin, history intact — then pin */
      await db.user.update({
        where: { id: legacy.id },
        data: { email: ADMIN_EMAIL, name: ADMIN_NAME },
      });
      await repair(legacy.id, legacy.passwordHash, true);
      return "ok";
    }

    const created = await db.user.create({
      data: {
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        passwordHash: await hashPassword(adminPassword()),
      },
    });
    await ensureRoles(created.id);
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
    return "ok";
  } catch {
    /* schema not migrated or DB unreachable — nothing cached; the next
       attempt heals the moment the database is ready */
    return "failed";
  }
}

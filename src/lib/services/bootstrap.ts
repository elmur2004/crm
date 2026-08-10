import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/hash";

/* SELF-HEALING ADMIN (founder directive: the admin is admin@byteforce.com /
   password123, named Elmur, both entities, identical in every environment).
   Called before sign-in: whatever state the database is in — never seeded,
   legacy admin email, flags broken — the admin account ends up usable.
   An EXISTING admin's password is NEVER touched here (rotations survive);
   only a missing admin is created with the documented password. */

const ADMIN_EMAIL = "admin@byteforce.com";
const LEGACY_EMAIL = "admin@b-systems.example";
const ADMIN_NAME = "Elmur";
const ADMIN_ROLES = ["bsystems_admin", "byteforce_staff"] as const;
const ADMIN_PASSWORD = "password123"; // rotate after first production login

async function ensureRoles(userId: string): Promise<void> {
  for (const role of ADMIN_ROLES) {
    await db.userRole.upsert({
      where: { userId_role: { userId, role } },
      update: {},
      create: { userId, role },
    });
  }
}

/* No caching: one indexed SELECT per sign-in attempt is negligible, and an
   uncached check means the admin heals on the VERY NEXT login after any
   incident (wiped table, botched import, flag damage). */
export async function ensureAdminExists(): Promise<void> {
  try {
    const existing = await db.user.findUnique({ where: { email: ADMIN_EMAIL } });
    if (existing) {
      /* repair flags only — NEVER the password (rotations survive) */
      if (!existing.active || existing.registrationStatus !== "approved") {
        await db.user.update({
          where: { id: existing.id },
          data: { active: true, registrationStatus: "approved" },
        });
      }
      await ensureRoles(existing.id);
      return;
    }

    const legacy = await db.user.findUnique({ where: { email: LEGACY_EMAIL } });
    if (legacy) {
      /* rename in place — one admin, history intact, password preserved */
      await db.user.update({
        where: { id: legacy.id },
        data: {
          email: ADMIN_EMAIL,
          name: ADMIN_NAME,
          active: true,
          registrationStatus: "approved",
        },
      });
      await ensureRoles(legacy.id);
      return;
    }

    const created = await db.user.create({
      data: {
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        passwordHash: await hashPassword(ADMIN_PASSWORD),
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
  } catch {
    /* schema not migrated yet or DB unreachable — sign-in will surface that;
       nothing is cached, so the next attempt heals once the DB is ready */
  }
}

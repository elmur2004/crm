import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { BOOTSTRAP_ADMIN_EMAILS, ensureAdminExists } from "./bootstrap";
import { hashPassword, verifyPassword } from "@/lib/auth/hash";

/* Founder: the admin MUST work in every environment, with the DOCUMENTED
   password (ADMIN_PASSWORD env, default password123) — the pin re-asserts the
   hash on every check, so a stale hash can never lock the admin out. */

beforeEach(async () => {
  await resetDb();
  delete process.env.ADMIN_PASSWORD;
});

afterEach(() => {
  delete process.env.ADMIN_PASSWORD;
});

describe("Admin bootstrap (self-healing, password-pinned)", () => {
  it("creates Elmur / admin@byteforce.com / password123 with BOTH roles on an empty database", async () => {
    expect(await ensureAdminExists()).toBe("ok");
    const admin = await db.user.findUniqueOrThrow({
      where: { email: "admin@byteforce.com" },
      include: { roles: true },
    });
    expect(admin.name).toBe("Elmur");
    expect(admin.active).toBe(true);
    expect(admin.registrationStatus).toBe("approved");
    expect(admin.roles.map((r) => r.role).sort()).toEqual(["bsystems_admin", "byteforce_staff"]);
    expect(await verifyPassword("password123", admin.passwordHash)).toBe(true);
    const log = await db.activityLog.findFirst({ where: { trigger: "admin_bootstrap" } });
    expect(log).toBeTruthy();
  });

  it("PINS the password: a stale/unknown hash is repaired back to the documented password", async () => {
    const broken = await db.user.create({
      data: {
        name: "Elmur",
        email: "admin@byteforce.com",
        passwordHash: await hashPassword("SomeOld#Unknown1"),
        active: false,
        registrationStatus: "pending",
      },
    });
    expect(await ensureAdminExists()).toBe("ok");
    const healed = await db.user.findUniqueOrThrow({
      where: { id: broken.id },
      include: { roles: true },
    });
    expect(healed.active).toBe(true);
    expect(healed.registrationStatus).toBe("approved");
    expect(healed.roles.map((r) => r.role).sort()).toEqual(["bsystems_admin", "byteforce_staff"]);
    /* founder's rule: the documented password ALWAYS signs in */
    expect(await verifyPassword("password123", healed.passwordHash)).toBe(true);
  });

  it("honors ADMIN_PASSWORD for rotation — the custom value is pinned instead", async () => {
    process.env.ADMIN_PASSWORD = "Rotated#Secret9";
    await db.user.create({
      data: {
        name: "Elmur",
        email: "admin@byteforce.com",
        passwordHash: await hashPassword("password123"),
      },
    });
    expect(await ensureAdminExists()).toBe("ok");
    const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@byteforce.com" } });
    expect(await verifyPassword("Rotated#Secret9", admin.passwordHash)).toBe(true);
    expect(await verifyPassword("password123", admin.passwordHash)).toBe(false);

    /* and a matching hash is left untouched (no needless rewrites) */
    const before = admin.passwordHash;
    await ensureAdminExists();
    const after = await db.user.findUniqueOrThrow({ where: { email: "admin@byteforce.com" } });
    expect(after.passwordHash).toBe(before);
  });

  it("renames a legacy admin@b-systems.example in place and pins the password", async () => {
    const legacy = await db.user.create({
      data: {
        name: "Platform Admin",
        email: "admin@b-systems.example",
        passwordHash: await hashPassword("admin123"),
      },
    });
    expect(await ensureAdminExists()).toBe("ok");
    const renamed = await db.user.findUniqueOrThrow({
      where: { email: "admin@byteforce.com" },
      include: { roles: true },
    });
    expect(renamed.id).toBe(legacy.id);
    expect(renamed.name).toBe("Elmur");
    expect(await db.user.findUnique({ where: { email: "admin@b-systems.example" } })).toBeNull();
    expect(await verifyPassword("password123", renamed.passwordHash)).toBe(true);
    expect(renamed.roles.map((r) => r.role).sort()).toEqual(["bsystems_admin", "byteforce_staff"]);
  });

  it("backfills the visible password when the hash matches but the copy is missing", async () => {
    await db.user.create({
      data: {
        name: "Elmur",
        email: "admin@byteforce.com",
        passwordHash: await hashPassword("password123"),
        passwordPlain: null, // account predates the visibility column
      },
    });
    await ensureAdminExists();
    const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@byteforce.com" } });
    expect(admin.passwordPlain).toBe("password123");
  });

  it("is idempotent — repeated calls change nothing", async () => {
    await ensureAdminExists();
    await ensureAdminExists();
    await ensureAdminExists();
    /* ADR-074 — counted PER ADMIN rather than globally. The global count said
       "2" and meant "the one admin's two roles", which stopped being true the
       moment a second administrator joined the table while the property it was
       protecting — nothing duplicated — still held. Per-account is what was
       always meant, and it survives the next one. */
    for (const email of BOOTSTRAP_ADMIN_EMAILS) {
      const admin = await db.user.findUniqueOrThrow({
        where: { email },
        include: { roles: true },
      });
      expect(await db.user.count({ where: { email } })).toBe(1);
      expect(admin.roles.map((r) => r.role).sort()).toEqual(
        [...new Set(admin.roles.map((r) => r.role))].sort(),
      );
    }
  });
});

/* ============================================================================
   ADR-074 — A BOOTSTRAP ADMIN'S ROLES ARE ASSERTED, NARROWLY.

   The mechanism was built for two administrators, so that neither could end up
   holding the other's app: each admin's own roles are upserted and any role
   owned by ANOTHER bootstrap admin is revoked BY NAME. ADR-080 removed the
   second administrator, so there is nothing to revoke today — and the narrow
   shape is what survives, because the alternative ("revoke everything not in the
   list") would silently undo a role the founder granted from the Users screen.
   That is the case below, and it is the one that still has teeth.
   ========================================================================== */

describe("ADR-074 — the bootstrap asserts roles without confiscating them", () => {
  it("leaves a role the founder granted by hand alone", async () => {
    /* narrow revocation, by name: only roles owned by ANOTHER bootstrap admin
       are taken away. Silently undoing a grant made from the Users screen would
       be a worse surprise than the one this whole mechanism fixes. */
    await ensureAdminExists();
    const bs = await db.user.findUniqueOrThrow({ where: { email: "admin@byteforce.com" } });
    await db.userRole.create({ data: { userId: bs.id, role: "bsystems_sales" } });

    expect(await ensureAdminExists()).toBe("ok");
    const healed = await db.user.findUniqueOrThrow({
      where: { email: "admin@byteforce.com" },
      include: { roles: true },
    });
    expect(healed.roles.map((r) => r.role).sort()).toEqual([
      "bsystems_admin",
      "bsystems_sales",
      "byteforce_staff",
    ]);
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { ensureAdminExists } from "./bootstrap";
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
    expect(await db.user.count({ where: { email: "admin@byteforce.com" } })).toBe(1);
    expect(await db.userRole.count()).toBe(2);
  });
});

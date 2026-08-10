import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { ensureAdminExists } from "./bootstrap";
import { hashPassword, verifyPassword } from "@/lib/auth/hash";

/* Founder: the admin MUST work in every environment. ensureAdminExists runs
   before every sign-in and heals whatever state the database is in. */

beforeEach(async () => {
  await resetDb();
});

describe("Admin bootstrap (self-healing production admin)", () => {
  it("creates Elmur / admin@byteforce.com / password123 with BOTH roles on an empty database", async () => {
    await ensureAdminExists();
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

  it("repairs a broken admin (inactive/pending/missing roles) WITHOUT touching a rotated password", async () => {
    const rotatedHash = await hashPassword("Rotated#Secret9");
    const broken = await db.user.create({
      data: {
        name: "Elmur",
        email: "admin@byteforce.com",
        passwordHash: rotatedHash,
        active: false,
        registrationStatus: "pending",
      },
    });
    await ensureAdminExists();
    const healed = await db.user.findUniqueOrThrow({
      where: { id: broken.id },
      include: { roles: true },
    });
    expect(healed.active).toBe(true);
    expect(healed.registrationStatus).toBe("approved");
    expect(healed.roles.map((r) => r.role).sort()).toEqual(["bsystems_admin", "byteforce_staff"]);
    expect(await verifyPassword("Rotated#Secret9", healed.passwordHash)).toBe(true);
    expect(await verifyPassword("password123", healed.passwordHash)).toBe(false);
  });

  it("renames a legacy admin@b-systems.example in place (one admin, password preserved)", async () => {
    const legacy = await db.user.create({
      data: {
        name: "Platform Admin",
        email: "admin@b-systems.example",
        passwordHash: await hashPassword("admin123"),
      },
    });
    await ensureAdminExists();
    const renamed = await db.user.findUniqueOrThrow({
      where: { email: "admin@byteforce.com" },
      include: { roles: true },
    });
    expect(renamed.id).toBe(legacy.id);
    expect(renamed.name).toBe("Elmur");
    expect(await db.user.findUnique({ where: { email: "admin@b-systems.example" } })).toBeNull();
    expect(await verifyPassword("admin123", renamed.passwordHash)).toBe(true);
    expect(renamed.roles.map((r) => r.role).sort()).toEqual(["bsystems_admin", "byteforce_staff"]);
  });

  it("is idempotent — repeated calls change nothing", async () => {
    await ensureAdminExists();
    await ensureAdminExists();
    await ensureAdminExists();
    expect(await db.user.count({ where: { email: "admin@byteforce.com" } })).toBe(1);
    expect(await db.userRole.count()).toBe(2);
  });
});

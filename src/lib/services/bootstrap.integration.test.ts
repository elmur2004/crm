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
  delete process.env.MINDOO_ADMIN_PASSWORD;
});

afterEach(() => {
  delete process.env.ADMIN_PASSWORD;
  delete process.env.MINDOO_ADMIN_PASSWORD;
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
       "2" and meant "the one admin's two roles"; with a second administrator on
       the table that sentence stopped being true while the property it was
       protecting — nothing duplicated — still held. Per-account is what was
       always meant, and it survives a third. */
    for (const email of ["admin@byteforce.com", "admin@mindoo.com"]) {
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
   ADR-074 — MINDOO'S ADMINISTRATOR IS BOOTSTRAPPED TOO.

   The founder asked for Mindoo by credential — "I enter the creditials :
   admin@mindoo.com and password123" — and that account was created by the SEED
   alone. The production launcher runs `prisma migrate deploy` and never
   `prisma db seed`, so a seeded-only account reaches a freshly seeded local
   database and nowhere else: the credential he was given answered "wrong
   password" on every other environment, forever, with nothing in the product to
   explain it. Which is exactly what he reported.
   ========================================================================== */

describe("ADR-074 — Mindoo's administrator heals like B-Systems'", () => {
  it("is created on an empty database, approved, with its one role", async () => {
    expect(await ensureAdminExists()).toBe("ok");
    const admin = await db.user.findUniqueOrThrow({
      where: { email: "admin@mindoo.com" },
      include: { roles: true },
    });
    expect(admin.name).toBe("Mindoo Admin");
    expect(admin.active).toBe(true);
    expect(admin.registrationStatus).toBe("approved");
    expect(admin.roles.map((r) => r.role)).toEqual(["mindoo_staff"]);
    expect(await verifyPassword("password123", admin.passwordHash)).toBe(true);
  });

  it("repairs a stale hash, exactly as the other admin's pin does", async () => {
    await db.user.create({
      data: {
        name: "Mindoo Admin",
        email: "admin@mindoo.com",
        passwordHash: await hashPassword("something-else"),
        active: false,
        registrationStatus: "pending",
      },
    });
    expect(await ensureAdminExists()).toBe("ok");
    const admin = await db.user.findUniqueOrThrow({
      where: { email: "admin@mindoo.com" },
      include: { roles: true },
    });
    expect(await verifyPassword("password123", admin.passwordHash)).toBe(true);
    expect(admin.active).toBe(true);
    expect(admin.registrationStatus).toBe("approved");
    expect(admin.roles.map((r) => r.role)).toEqual(["mindoo_staff"]);
  });

  it("honours its OWN password env, and not the other admin's", async () => {
    /* per-account on purpose: rotating one company's administrator must not
       silently change another company's */
    process.env.MINDOO_ADMIN_PASSWORD = "mindoo-rotated";
    process.env.ADMIN_PASSWORD = "bsystems-rotated";
    expect(await ensureAdminExists()).toBe("ok");
    const mindoo = await db.user.findUniqueOrThrow({ where: { email: "admin@mindoo.com" } });
    const bsystems = await db.user.findUniqueOrThrow({ where: { email: "admin@byteforce.com" } });
    expect(await verifyPassword("mindoo-rotated", mindoo.passwordHash)).toBe(true);
    expect(await verifyPassword("bsystems-rotated", bsystems.passwordHash)).toBe(true);
  });

  it("REVOKES the other app's role — the two administrators never overlap", async () => {
    /* the ADR-073 state, which every database seeded before ADR-074 still
       carries: one account holding all three companies. Holding both apps puts
       it in whichever one `landingFor` names and hands it a module switcher
       that crosses the wall. */
    await ensureAdminExists();
    const bs = await db.user.findUniqueOrThrow({ where: { email: "admin@byteforce.com" } });
    await db.userRole.create({ data: { userId: bs.id, role: "mindoo_staff" } });

    expect(await ensureAdminExists()).toBe("ok");
    const healed = await db.user.findUniqueOrThrow({
      where: { email: "admin@byteforce.com" },
      include: { roles: true },
    });
    expect(healed.roles.map((r) => r.role).sort()).toEqual(["bsystems_admin", "byteforce_staff"]);
  });

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

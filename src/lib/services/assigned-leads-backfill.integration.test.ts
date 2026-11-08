import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";

/* ============================================================================
   ASSIGNED LEADS ONLY — the one-time ownership backfill, run AS SHIPPED.

   Founder (2026-11-08): "Give them to whoever added them", and "Both companies
   now". The migration hands every unowned lead that is plainly somebody's to
   that somebody, and leaves the rest UNASSIGNED (the company admin's).

   This executes the migration FILE'S OWN TEXT — read from disk, never a copy —
   through a plain `pg` client, so its BEGIN/COMMIT, its comments and both of its
   statements run exactly as `prisma migrate deploy` runs them. The fixtures
   cover every branch of the rule, for both companies, and the test asserts
   EXACTLY which rows changed (every other row is byte-identical), the History
   row each change writes, that `updatedAt` is left alone, and that a second run
   changes nothing at all.
   ========================================================================== */

const MIGRATION = path.join(
  process.cwd(),
  "prisma",
  "migrations",
  "20261108120000_assigned_leads_only",
  "migration.sql",
);

async function runMigration(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(readFileSync(MIGRATION, "utf8"));
  } finally {
    await client.end();
  }
}

async function user(
  name: string,
  roles: string[],
  opts: { active?: boolean; registrationStatus?: string } = {},
) {
  return db.user.create({
    data: {
      name,
      email: `${name.trim().toLowerCase().replace(/\s+/g, ".")}.${Math.random().toString(36).slice(2, 8)}@example.test`,
      passwordHash: "x",
      active: opts.active ?? true,
      registrationStatus: opts.registrationStatus ?? "approved",
      roles: { create: roles.map((role) => ({ role })) },
    },
  });
}

const card = (brand: string, name: string) => db.salesRep.create({ data: { brand, name } });

let seq = 0;
async function lead(
  brand: "bsystems" | "byteforce",
  name: string,
  data: {
    salesRepId?: string | null;
    createdByUserId?: string | null;
    ownerUserId?: string | null;
    ownerType?: string;
    archived?: boolean;
  } = {},
) {
  return db.lead.create({
    data: {
      brand,
      name,
      number: `01000000${String(seq++).padStart(3, "0")}`,
      type: "cold_call",
      ownerType: data.ownerType ?? "internal",
      salesRepId: data.salesRepId ?? null,
      createdByUserId: data.createdByUserId ?? null,
      ownerUserId: data.ownerUserId ?? null,
      archived: data.archived ?? false,
    },
  });
}

/** name → { ownerUserId, ownerType, updatedAt, salesRepId } for every lead. */
async function snapshot() {
  const rows = await db.lead.findMany({
    select: { name: true, ownerUserId: true, ownerType: true, updatedAt: true, salesRepId: true },
  });
  return Object.fromEntries(rows.map((r) => [r.name, r]));
}

describe("migration 20261108120000 — the ownership backfill, as shipped", () => {
  beforeEach(resetDb);

  it("hands each plainly-owned lead to its person, leaves the rest unassigned, and is idempotent", async () => {
    /* ---- the people ---- */
    const omar = await user("Omar Farouk", ["bsystems_sales"]);
    const twinA = await user("Twin Name", ["bsystems_sales"]);
    const twinB = await user("Twin Name", ["bsystems_sales"]);
    const salesAdmin = await user("Boss", ["bsystems_sales", "bsystems_admin"]);
    const goneSales = await user("Gone Sales", ["bsystems_sales"], { active: false });
    const pendingSales = await user("Pending Sales", ["bsystems_sales"], {
      registrationStatus: "pending",
    });
    const sara = await user("Sara Hassan", ["byteforce_staff"]);
    await user("twin bf", ["byteforce_staff"]);
    await user("Twin BF ", ["byteforce_staff"]);
    const nadia = await user("Nadia Samir", ["byteforce_staff"]);
    const founder = await user("Elmur", ["byteforce_staff", "bsystems_admin"]);

    /* ---- the legacy rep cards ---- */
    const bsOmar = await card("bsystems", "Omar Farouk");
    const bsOmarLower = await card("bsystems", "omar farouk");
    const bsTwin = await card("bsystems", "Twin Name");
    const bsNobody = await card("bsystems", "Nobody");
    const bfSara = await card("byteforce", "  sara HASSAN  ");
    const bfTwin = await card("byteforce", "Twin BF");
    const bfFounder = await card("byteforce", "Elmur");

    /* ---- B-Systems ---- */
    await lead("bsystems", "bs matched card", { salesRepId: bsOmar.id });
    await lead("bsystems", "bs card case differs", { salesRepId: bsOmarLower.id }); // exact only
    await lead("bsystems", "bs ambiguous card, sales creator", {
      salesRepId: bsTwin.id,
      createdByUserId: omar.id,
    });
    await lead("bsystems", "bs ambiguous card, no creator", { salesRepId: bsTwin.id });
    await lead("bsystems", "bs unmatched card, sales creator", {
      salesRepId: bsNobody.id,
      createdByUserId: twinA.id,
    });
    await lead("bsystems", "bs creator is admin", { createdByUserId: salesAdmin.id });
    await lead("bsystems", "bs creator deactivated", { createdByUserId: goneSales.id });
    await lead("bsystems", "bs creator pending", { createdByUserId: pendingSales.id });
    await lead("bsystems", "bs creator is ByteForce staff", { createdByUserId: sara.id });
    await lead("bsystems", "bs already owned", { salesRepId: bsOmar.id, ownerUserId: twinB.id });
    await lead("bsystems", "bs admin bucket, no owner", {
      salesRepId: bsOmar.id,
      ownerType: "admin",
    });
    await lead("bsystems", "bs archived matched", { salesRepId: bsOmar.id, archived: true });

    /* ---- ByteForce ---- */
    await lead("byteforce", "bf matched card (case/space-insensitive)", { salesRepId: bfSara.id });
    await lead("byteforce", "bf ambiguous card, no creator", { salesRepId: bfTwin.id });
    await lead("byteforce", "bf ambiguous card, staff creator", {
      salesRepId: bfTwin.id,
      createdByUserId: nadia.id,
    });
    await lead("byteforce", "bf card names the admin", {
      salesRepId: bfFounder.id,
      createdByUserId: founder.id,
    });
    await lead("byteforce", "bf staff creator", { createdByUserId: nadia.id });
    await lead("byteforce", "bf creator holds no ByteForce role", { createdByUserId: omar.id });
    await lead("byteforce", "bf already owned", { salesRepId: bfSara.id, ownerUserId: nadia.id });
    await lead("byteforce", "bf archived, staff creator", {
      createdByUserId: nadia.id,
      archived: true,
    });
    /* the B-Systems rule reads B-Systems leads only — a ByteForce lead whose
       card happens to carry a B-Systems seller's exact name is not his */
    await lead("byteforce", "bf card named like a BS seller", { salesRepId: bsOmar.id });

    const before = await snapshot();

    await runMigration();

    const after = await snapshot();
    const owner = (name: string) => after[name]!.ownerUserId;

    /* exactly these rows changed hands … */
    const expected: Record<string, string> = {
      "bs matched card": omar.id,
      "bs ambiguous card, sales creator": omar.id,
      "bs unmatched card, sales creator": twinA.id,
      "bs archived matched": omar.id,
      "bf matched card (case/space-insensitive)": sara.id,
      "bf ambiguous card, staff creator": nadia.id,
      "bf staff creator": nadia.id,
      "bf archived, staff creator": nadia.id,
    };
    for (const [name, id] of Object.entries(expected)) {
      expect(owner(name), name).toBe(id);
    }
    /* … and every other row is exactly as it was */
    for (const name of Object.keys(before)) {
      if (name in expected) continue;
      expect(after[name], name).toEqual(before[name]);
    }
    expect(owner("bs already owned")).toBe(twinB.id);
    expect(owner("bf already owned")).toBe(nadia.id);
    for (const name of [
      "bs card case differs",
      "bs ambiguous card, no creator",
      "bs creator is admin",
      "bs creator deactivated",
      "bs creator pending",
      "bs creator is ByteForce staff",
      "bs admin bucket, no owner",
      "bf ambiguous card, no creator",
      "bf card names the admin",
      "bf creator holds no ByteForce role",
      "bf card named like a BS seller",
    ]) {
      expect(owner(name), `${name} stays unassigned`).toBeNull();
    }

    /* the bucket, the legacy card and updatedAt are untouched on the moved rows */
    for (const name of Object.keys(expected)) {
      expect(after[name]!.ownerType, name).toBe(before[name]!.ownerType);
      expect(after[name]!.salesRepId, name).toBe(before[name]!.salesRepId);
      expect(after[name]!.updatedAt.toISOString(), name).toBe(before[name]!.updatedAt.toISOString());
    }

    /* ONE History row per changed lead, and none for anything else */
    const logs = await db.activityLog.findMany({ where: { trigger: "backfill_owner" } });
    expect(logs).toHaveLength(Object.keys(expected).length);
    const leadIds = new Set(
      (
        await db.lead.findMany({
          where: { name: { in: Object.keys(expected) } },
          select: { id: true },
        })
      ).map((l) => l.id),
    );
    for (const log of logs) {
      expect(leadIds.has(log.entityId)).toBe(true);
      expect(log).toMatchObject({
        entityType: "lead",
        actorId: null,
        actorLabel: "System",
        action: "update",
        trigger: "backfill_owner",
      });
    }
    expect(new Set(logs.map((l) => l.entityId)).size).toBe(logs.length);

    /* ---- run it AGAIN: nothing more changes, nothing is logged twice ---- */
    await runMigration();
    expect(await snapshot()).toEqual(after);
    expect(await db.activityLog.count({ where: { trigger: "backfill_owner" } })).toBe(logs.length);
  });

  it("a lead created after a first run is still decided by a second one — and only it", async () => {
    const omar = await user("Omar Farouk", ["bsystems_sales"]);
    await runMigration(); // an empty database: a no-op, and no error
    expect(await db.activityLog.count()).toBe(0);
    await lead("bsystems", "late lead", { createdByUserId: omar.id });
    await runMigration();
    const late = await db.lead.findFirstOrThrow({ where: { name: "late lead" } });
    expect(late.ownerUserId).toBe(omar.id);
    expect(await db.activityLog.count({ where: { trigger: "backfill_owner" } })).toBe(1);
  });
});

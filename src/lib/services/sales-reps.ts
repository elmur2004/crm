import { z } from "zod";
import { db } from "@/lib/db";
import type { Brand } from "@/lib/pipeline-engine/constants";

/* §6.1 — rep cards; reps can be added without limit (name required). */

export const createRepSchema = z.object({ name: z.string().min(1).max(200) });

export function createRep(brand: Brand, input: z.infer<typeof createRepSchema>) {
  return db.salesRep.create({ data: { brand, name: input.name } });
}

export async function listRepsWithCounts(brand: Brand) {
  const reps = await db.salesRep.findMany({
    where: { brand },
    include: { _count: { select: { leads: true } } },
    orderBy: { name: "asc" },
  });
  return reps.map((r) => ({ id: r.id, name: r.name, leadCount: r._count.leads }));
}

export async function listReps(brand: Brand) {
  return db.salesRep.findMany({ where: { brand }, orderBy: { name: "asc" } });
}

/* V2 §3 (ADR-038) — the B-Systems Owner list for the admin/sales stage forms.
   The B-Systems app has NO rep-cards screen (§6.1 is ByteForce-only), so on a
   live system SalesRep has no "bsystems" rows and the Owner select rendered
   empty. The internal sales team actually lives in Users (role bsystems_sales,
   V2 §0 role map) — cards are auto-provisioned here, on read, for every active
   sales account without one (matched by exact name, idempotent), keeping
   FollowUp.ownerSalesRepId on its SalesRep FK. */
export async function listBsOwnerReps() {
  const [team, existing] = await Promise.all([
    db.user.findMany({
      where: { active: true, roles: { some: { role: "bsystems_sales" } } },
      select: { name: true },
    }),
    db.salesRep.findMany({ where: { brand: "bsystems" }, select: { name: true } }),
  ]);
  const have = new Set(existing.map((r) => r.name));
  const missing = [...new Set(team.map((u) => u.name))].filter((n) => !have.has(n));
  if (missing.length > 0) {
    await db.salesRep.createMany({
      data: missing.map((name) => ({ brand: "bsystems", name })),
    });
  }
  return listReps("bsystems");
}

/** A-6: partner-sourced leads may be unassigned — surfaced as their own bucket. */
export function countUnassigned(brand: Brand) {
  return db.lead.count({ where: { brand, salesRepId: null } });
}

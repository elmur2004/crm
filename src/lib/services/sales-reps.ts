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

/** A-6: partner-sourced leads may be unassigned — surfaced as their own bucket. */
export function countUnassigned(brand: Brand) {
  return db.lead.count({ where: { brand, salesRepId: null } });
}

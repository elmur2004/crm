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
    /* ADR-043: archived leads leave the rep-card counts too */
    include: { _count: { select: { leads: { where: { archived: false } } } } },
    orderBy: { name: "asc" },
  });
  return reps.map((r) => ({ id: r.id, name: r.name, leadCount: r._count.leads }));
}

export async function listReps(brand: Brand) {
  return db.salesRep.findMany({ where: { brand }, orderBy: { name: "asc" } });
}

/* V2 §3 (ADR-038) — the B-Systems rep roster for the stage forms. The
   B-Systems app has NO rep-cards screen (§6.1 is ByteForce-only), so on a live
   system SalesRep has no "bsystems" rows and every picker rendered empty. The
   internal sales team actually lives in Users (role bsystems_sales, V2 §0 role
   map) — cards are auto-provisioned here, on read, for every active sales
   account without one (matched by exact name, idempotent).

   ADR-082 — the FOLLOW-UP Owner select this was built for is gone ("remove the
   owner selection field"), so the remaining consumers are the Add-lead rep
   picker (ADR-079) and the meeting form's Technical support datalist. The
   auto-provision still runs on every CRM board open, so nothing about the
   SalesRep rows themselves changed; `FollowUp.ownerSalesRepId` keeps its FK and
   every row already pointing at one. */
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

/* ============================================================================
   Founder (2026-11-08, "assigned leads only" — "Both companies now"). ByteForce
   leads belong to staff ACCOUNTS now, not to rep cards: the Leads page's cards
   are OWNERS (accounts with their lead counts) plus the Unassigned card, and a
   SalesRep card decides nobody's visibility any more (the column and its history
   stay; nothing in the UI writes it).
   ========================================================================== */

/** Unassigned = NO OWNER ACCOUNT, whatever legacy rep card the row carries —
    the leads only the admin sees, waiting for him to hand them out. */
export function countUnassigned(brand: Brand) {
  return db.lead.count({ where: { brand, ownerUserId: null, archived: false } });
}

/* Hardening (review): the Unassigned card is the ONLY door to the unassigned
   view — it must still render when every unassigned lead is archived, or the
   archive becomes unreachable for that bucket. */
export function countUnassignedArchived(brand: Brand) {
  return db.lead.count({ where: { brand, ownerUserId: null, archived: true } });
}

export interface OwnerCard {
  id: string;
  name: string;
  leadCount: number;
}

/** The admin's owner cards: every live ByteForce staff account (count 0
    included, so a new teammate is visible the day he is created), PLUS anybody
    else who still owns a live ByteForce lead (a deactivated teammate, a removed
    role) — a lead must never become unreachable because its owner left. */
export async function listOwnerCards(brand: Brand): Promise<OwnerCard[]> {
  const [staff, groups] = await Promise.all([
    db.user.findMany({
      where: {
        active: true,
        registrationStatus: "approved",
        roles: { some: { role: brand === "byteforce" ? "byteforce_staff" : "bsystems_sales" } },
      },
      select: { id: true, name: true },
    }),
    db.lead.groupBy({
      by: ["ownerUserId"],
      where: { brand, archived: false, ownerUserId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const counts = new Map<string, number>();
  for (const g of groups) if (g.ownerUserId) counts.set(g.ownerUserId, g._count._all);
  const names = new Map(staff.map((u) => [u.id, u.name]));
  const missing = [...counts.keys()].filter((id) => !names.has(id));
  if (missing.length > 0) {
    for (const u of await db.user.findMany({
      where: { id: { in: missing } },
      select: { id: true, name: true },
    })) {
      names.set(u.id, u.name);
    }
  }
  return [...names.entries()]
    .map(([id, name]) => ({ id, name, leadCount: counts.get(id) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

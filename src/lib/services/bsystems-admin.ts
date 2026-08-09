import { db } from "@/lib/db";
import { BSYSTEMS_STAGES } from "@/lib/pipeline-engine/constants";
import { internalDashboard, type InternalDashboard } from "./metrics";

/* V2 §2.1 — the admin Home: the v1 dashboard PLUS agent/partner counts and their
   leads' stage distribution. Plus the Agents-section queries (§2.7) and the
   Registrations feed (§2.8 lives in users.ts). */

export interface AdminHomeV2 {
  base: InternalDashboard;
  agentCount: number;
  partnerCount: number;
  /** stage → count over agent+partner-owned leads (the chart's data) */
  externalPipeline: Record<string, number>;
}

export async function adminHome(): Promise<AdminHomeV2> {
  const [base, agentCount, partnerCount, stageGroups] = await Promise.all([
    internalDashboard("bsystems"),
    db.userRole.count({ where: { role: "bsystems_agent" } }),
    db.partner.count(),
    db.lead.groupBy({
      by: ["stage"],
      where: { brand: "bsystems", ownerType: { in: ["agent", "partner"] } },
      _count: { _all: true },
    }),
  ]);
  const externalPipeline: Record<string, number> = {};
  for (const stage of BSYSTEMS_STAGES) externalPipeline[stage] = 0;
  for (const g of stageGroups) externalPipeline[g.stage] = g._count._all;
  return { base, agentCount, partnerCount, externalPipeline };
}

/** V2 §2.7 — Agents section, Detailed view: profile + join date + their leads. */
export function listAgentsDetailed() {
  return db.portalRep.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          phone: true,
          active: true,
          createdAt: true,
          ownedLeads: {
            orderBy: { createdAt: "desc" },
            select: { id: true, name: true, number: true, stage: true, createdAt: true },
          },
        },
      },
    },
    orderBy: { firstName: "asc" },
  });
}

/** V2 §2.2/§2.3 — the unified leads/board source with the owner-bucket filter. */
export function listBsLeads(ownerType?: string) {
  return db.lead.findMany({
    where: {
      brand: "bsystems",
      ...(ownerType && ownerType !== "any" ? { ownerType } : {}),
    },
    include: {
      owner: { select: { name: true } },
      salesRep: { select: { name: true } },
      partner: { select: { companyName: true } },
      followUps: { orderBy: { createdAt: "desc" }, take: 1 },
      meetings: { orderBy: { createdAt: "desc" }, take: 1 },
      proposals: { orderBy: { createdAt: "desc" }, take: 1 },
      lostInfo: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/** Owner's own board (agent/partner). */
export function listOwnLeads(userId: string) {
  return db.lead.findMany({
    where: { brand: "bsystems", ownerUserId: userId },
    include: {
      owner: { select: { name: true } },
      salesRep: { select: { name: true } },
      partner: { select: { companyName: true } },
      followUps: { orderBy: { createdAt: "desc" }, take: 1 },
      meetings: { orderBy: { createdAt: "desc" }, take: 1 },
      proposals: { orderBy: { createdAt: "desc" }, take: 1 },
      lostInfo: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
}

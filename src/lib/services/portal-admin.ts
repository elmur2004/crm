import { db } from "@/lib/db";
import { PORTAL_STAGES } from "@/lib/pipeline-engine/constants";
import { latestProposalValue } from "./leads";

/* §8.5 — admin data: dashboard formulas (each a tested query), the combined /
   per-rep board source, Won Deals management listing, and the Sales Team table. */

export interface AdminDashboard {
  totalLeads: number; // all deals, all reps, all stages
  totalEstimatedValue: number; // piasters; missing = 0 (ADR-012 per card)
  wonDealsCount: number;
  totalCommissions: number; // piasters
}

export async function adminDashboard(): Promise<AdminDashboard> {
  const [totalLeads, deals, wonDeals] = await Promise.all([
    db.portalDeal.count(),
    db.portalDeal.findMany({
      select: {
        stage: true,
        proposals: { select: { estimatedValue: true, createdAt: true } },
        wonDeal: { select: { estimatedValue: true } },
      },
    }),
    db.wonDeal.findMany({ select: { totalCommission: true } }),
  ]);

  /* §8.5.1 "sum of Estimated value across all deals (missing = 0)" under the
     ADR-012 convention: won deals use WonDeal.estimatedValue, others the latest
     proposal's value. */
  const totalEstimatedValue = deals.reduce((sum, d) => {
    if (d.stage === "won") return sum + (d.wonDeal?.estimatedValue ?? 0);
    return sum + (latestProposalValue(d.proposals) ?? 0);
  }, 0);

  return {
    totalLeads,
    totalEstimatedValue,
    wonDealsCount: deals.filter((d) => d.stage === "won").length,
    totalCommissions: wonDeals.reduce((sum, w) => sum + (w.totalCommission ?? 0), 0),
  };
}

/** §8.5.2 — combined board (admin), each card labeled with its rep. */
export function listAllDeals() {
  return db.portalDeal.findMany({
    include: {
      rep: { select: { id: true, firstName: true, lastName: true } },
      followUps: { orderBy: { createdAt: "desc" }, take: 1 },
      meetings: { orderBy: { createdAt: "desc" }, take: 1 },
      proposals: { orderBy: { createdAt: "desc" }, take: 1 },
      lostInfo: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export function listPortalReps() {
  return db.portalRep.findMany({
    orderBy: { firstName: "asc" },
    select: { id: true, firstName: true, lastName: true },
  });
}

/** §8.5.3 — every won deal regardless of rep, with milestones (admin sees values). */
export function listWonDealsForAdmin() {
  return db.wonDeal.findMany({
    include: {
      deal: { include: { rep: { select: { firstName: true, lastName: true } } } },
      milestones: { orderBy: { index: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/* §8.5.4 — Sales Team table. */
export interface SalesTeamRow {
  repId: string;
  repName: string;
  totalLeads: number;
  perStage: Record<string, number>;
  wonDeals: number;
  wonValue: number; // piasters — sum of WonDeal.estimatedValue of their won deals
  totalCommission: number; // piasters
}

export async function salesTeamTable(): Promise<SalesTeamRow[]> {
  const reps = await db.portalRep.findMany({
    include: {
      deals: {
        select: {
          stage: true,
          wonDeal: { select: { estimatedValue: true, totalCommission: true } },
        },
      },
    },
    orderBy: { firstName: "asc" },
  });

  return reps.map((rep) => {
    const perStage: Record<string, number> = {};
    for (const stage of PORTAL_STAGES) perStage[stage] = 0;
    let wonValue = 0;
    let totalCommission = 0;
    for (const deal of rep.deals) {
      perStage[deal.stage] = (perStage[deal.stage] ?? 0) + 1;
      if (deal.stage === "won") {
        wonValue += deal.wonDeal?.estimatedValue ?? 0;
        totalCommission += deal.wonDeal?.totalCommission ?? 0;
      }
    }
    return {
      repId: rep.id,
      repName: `${rep.firstName} ${rep.lastName}`,
      totalLeads: rep.deals.length,
      perStage,
      wonDeals: perStage["won"] ?? 0,
      wonValue,
      totalCommission,
    };
  });
}

import { db } from "@/lib/db";
import type { Brand } from "@/lib/pipeline-engine/constants";
import { INTERNAL_STAGES } from "@/lib/pipeline-engine/constants";
import { latestProposalValue } from "./leads";

/* §6.5 — every dashboard number is a tested query. Missing money values count as 0.
   Pipeline value excludes Won and Lost. Per-card Estimated value follows ADR-012
   (latest proposal; Won cards use WonInfo). */

export interface InternalDashboard {
  totalLeads: number;
  leadsPerStage: Record<string, number>; // keyed by stage incl. "new"
  pipelineValue: number; // piasters
  wonValue: number; // piasters
  wonCount: number;
  lostCount: number;
  toBeCollected: number; // piasters
}

export async function internalDashboard(brand: Brand): Promise<InternalDashboard> {
  /* ADR-043: archived leads leave every lead-based number; client money
     (toBeCollected) survives archiving — the financial trail is untouched. */
  const [totalLeads, stageGroups, activeLeads, wonInfos, clients] = await Promise.all([
    db.lead.count({ where: { brand, archived: false } }),
    db.lead.groupBy({ by: ["stage"], where: { brand, archived: false }, _count: { _all: true } }),
    db.lead.findMany({
      where: { brand, archived: false, stage: { notIn: ["won", "lost"] } },
      select: { proposals: { select: { estimatedValue: true, createdAt: true } } },
    }),
    db.wonInfo.findMany({
      where: { lead: { brand, stage: "won", archived: false } },
      select: { estimatedValue: true },
    }),
    db.client.findMany({ where: { brand }, select: { toBeCollected: true } }),
  ]);

  const leadsPerStage: Record<string, number> = {};
  for (const stage of INTERNAL_STAGES) leadsPerStage[stage] = 0;
  for (const g of stageGroups) leadsPerStage[g.stage] = g._count._all;

  const pipelineValue = activeLeads.reduce(
    (sum, lead) => sum + (latestProposalValue(lead.proposals) ?? 0),
    0,
  );
  const wonValue = wonInfos.reduce((sum, w) => sum + w.estimatedValue, 0);
  const toBeCollected = clients.reduce((sum, c) => sum + (c.toBeCollected ?? 0), 0);

  return {
    totalLeads,
    leadsPerStage,
    pipelineValue,
    wonValue,
    wonCount: leadsPerStage["won"] ?? 0,
    lostCount: leadsPerStage["lost"] ?? 0,
    toBeCollected,
  };
}

import { db } from "@/lib/db";
import type { Brand } from "@/lib/pipeline-engine/constants";
import { configForBrand } from "@/lib/pipeline-engine/configs/for-brand";
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

/* ADR-089 — the two pipelines record a win in two different tables, and the
   money tiles must read the one their company's Won side effect writes:
   ByteForce's `create_client` writes WonInfo + Client (T-9 / A-1), B-Systems'
   `create_won_deal` writes WonDeal + milestones (V2 §4) and never touches
   WonInfo. This file used to read WonInfo and Client for both, so every
   B-Systems win confirmed since V2 counted as EGP 0 and its "To be collected"
   read a table B-Systems no longer writes.

   A TABLE, for the reason ADR-073 gives for `configForBrand`: the next company
   cannot inherit another one's win record silently — the compiler asks. */
const WON_RECORD: Record<Brand, "wonInfo" | "wonDeal"> = {
  byteforce: "wonInfo",
  bsystems: "wonDeal",
};

export async function internalDashboard(brand: Brand): Promise<InternalDashboard> {
  /* ADR-043: archived leads leave every lead-based number; client money
     (toBeCollected) survives archiving — the financial trail is untouched. */
  const [totalLeads, stageGroups, activeLeads, wonLeads, clients, openMilestones] =
    await Promise.all([
      db.lead.count({ where: { brand, archived: false } }),
      db.lead.groupBy({ by: ["stage"], where: { brand, archived: false }, _count: { _all: true } }),
      db.lead.findMany({
        where: { brand, archived: false, stage: { notIn: ["won", "lost"] } },
        select: { proposals: { select: { estimatedValue: true, createdAt: true } } },
      }),
      db.lead.findMany({
        where: { brand, stage: "won", archived: false },
        select: {
          wonInfo: { select: { estimatedValue: true } },
          wonDeal: { select: { estimatedValue: true } },
        },
      }),
      db.client.findMany({ where: { brand }, select: { toBeCollected: true } }),
      WON_RECORD[brand] === "wonDeal"
        ? db.milestone.findMany({
            where: { completed: false, wonDeal: { lead: { brand } } },
            select: { value: true },
          })
        : Promise.resolve([]),
    ]);

  /* ADR-089 — the cells come from the company's own stage list, so a stage the
     pipeline has (B-Systems' Negotiation, both companies' Postpone) can never
     be counted in Total leads and shown in no cell. */
  const leadsPerStage: Record<string, number> = {};
  for (const stage of configForBrand(brand).stages) leadsPerStage[stage] = 0;
  for (const g of stageGroups) leadsPerStage[g.stage] = g._count._all;

  const pipelineValue = activeLeads.reduce(
    (sum, lead) => sum + (latestProposalValue(lead.proposals) ?? 0),
    0,
  );
  /* One value per won lead, so Won value and Won count describe the same set
     of leads. A B-Systems lead won before V2 carries a WonInfo and no WonDeal;
     it keeps its WonInfo value rather than vanishing from the money. */
  const wonValue = wonLeads.reduce((sum, lead) => {
    const value =
      WON_RECORD[brand] === "wonDeal"
        ? (lead.wonDeal?.estimatedValue ?? lead.wonInfo?.estimatedValue ?? 0)
        : (lead.wonInfo?.estimatedValue ?? 0);
    return sum + value;
  }, 0);
  /* ByteForce: Σ Client.toBeCollected (§6.4 / ADR-024, unclamped). B-Systems:
     the value of every milestone not yet completed — the money a won deal has
     still to bring in — plus any pre-V2 Client balance, so nothing the tile
     showed before this fix silently disappears. Archived deals stay in, as
     client money always has. */
  const toBeCollected =
    clients.reduce((sum, c) => sum + (c.toBeCollected ?? 0), 0) +
    openMilestones.reduce((sum, m) => sum + m.value, 0);

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

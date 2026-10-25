import { db } from "@/lib/db";
import type { Brand } from "@/lib/pipeline-engine/constants";
import { configForBrand } from "@/lib/pipeline-engine/configs/for-brand";
import { latestProposalValue } from "./leads";
import { leadScopeWhere, type TodoScope } from "./todo";

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
  /* The Home's "Pipeline value (now)" card (dashboard spec W4) — the SAME
     active-lead set the pipeline value above is summed over, so the three can
     never describe different leads. ADR-072's parked column is shown as a
     share of the pipeline rather than excluded from it (§6.5 is normative:
     "not Won and not Lost"). */
  openCount: number;
  parkedValue: number; // piasters
  parkedCount: number;
  /** active stage → its share of the pipeline value, in the company's stage order */
  pipelineByStage: Record<string, number>;
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

/** Which won record a company's money reads (exported for the Home's period
    figures, which must read the same table this file does). */
export function wonRecordFor(brand: Brand): "wonInfo" | "wonDeal" {
  return WON_RECORD[brand];
}

/* The Home (dashboard spec §2.3) — `scope` is the To-Do's own wall,
   `leadScopeWhere`, so a narrower reader can only ever be handed a SUBSET of
   these figures. It defaults to the whole company, which is every caller this
   file had before the Home asked for one: their numbers are unchanged. */
export async function internalDashboard(
  brand: Brand,
  scope: TodoScope = { kind: "all" },
): Promise<InternalDashboard> {
  const scoped = leadScopeWhere(brand, scope);
  /* the terminal pair from the company's own config (ADR-073), never literals */
  const { wonStage, lostStage } = configForBrand(brand);
  /* the money records that hang off a lead follow the lead's wall; under the
     whole company they keep the exact predicate they always had (a legacy
     Client row with no lead still counts there, as it did before) */
  const clientWhere = scope.kind === "all" ? { brand } : { brand, lead: scoped };
  /* ADR-043: archived leads leave every lead-based number; client money
     (toBeCollected) survives archiving — the financial trail is untouched. */
  const [totalLeads, stageGroups, activeLeads, wonLeads, clients, openMilestones] =
    await Promise.all([
      db.lead.count({ where: { ...scoped, archived: false } }),
      db.lead.groupBy({ by: ["stage"], where: { ...scoped, archived: false }, _count: { _all: true } }),
      db.lead.findMany({
        where: { ...scoped, archived: false, stage: { notIn: [wonStage, lostStage] } },
        select: { stage: true, proposals: { select: { estimatedValue: true, createdAt: true } } },
      }),
      db.lead.findMany({
        where: { ...scoped, stage: wonStage, archived: false },
        select: {
          wonInfo: { select: { estimatedValue: true } },
          wonDeal: { select: { estimatedValue: true } },
        },
      }),
      db.client.findMany({ where: clientWhere, select: { toBeCollected: true } }),
      WON_RECORD[brand] === "wonDeal"
        ? db.milestone.findMany({
            where: { completed: false, wonDeal: { lead: scoped } },
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
  const config = configForBrand(brand);
  const pipelineByStage: Record<string, number> = {};
  for (const stage of config.stages) {
    if (stage !== config.wonStage && stage !== config.lostStage) pipelineByStage[stage] = 0;
  }
  let parkedValue = 0;
  let parkedCount = 0;
  for (const lead of activeLeads) {
    const value = latestProposalValue(lead.proposals) ?? 0;
    pipelineByStage[lead.stage] = (pipelineByStage[lead.stage] ?? 0) + value;
    if (config.postponeStage && lead.stage === config.postponeStage) {
      parkedValue += value;
      parkedCount += 1;
    }
  }
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
    wonCount: leadsPerStage[wonStage] ?? 0,
    lostCount: leadsPerStage[lostStage] ?? 0,
    toBeCollected,
    openCount: activeLeads.length,
    parkedValue,
    parkedCount,
    pipelineByStage,
  };
}

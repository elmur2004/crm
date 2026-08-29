import { db } from "@/lib/db";
import { BSYSTEMS_STAGES, type Brand } from "@/lib/pipeline-engine/constants";
import { leadSearchWhere, leadTypeWhere } from "./lead-search";
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

/* ADR-067 — `brand` scopes every LEAD figure on this screen and is REQUIRED,
   so the numbers follow the company the page resolved instead of a literal
   three files away from the render. The agent and partner COUNTS are roster
   facts (a user role and a Partner row carry no brand) and are meaningful only
   under B-Systems, which is the only company that renders this Home — under
   ByteForce the merged page returns the ByteForce dashboard long before it
   gets here. */
export async function adminHome(brand: Brand): Promise<AdminHomeV2> {
  const [base, agentCount, partnerCount, stageGroups] = await Promise.all([
    internalDashboard(brand),
    db.userRole.count({ where: { role: "bsystems_agent" } }),
    db.partner.count(),
    db.lead.groupBy({
      by: ["stage"],
      where: { brand, ownerType: { in: ["agent", "partner"] }, archived: false },
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
          /* ADR-069 — the WhatsApp mark this agent's number carries in the
             list is the mark on their PIPELINE CARD, because that is the
             record the chip exists on everywhere else (the board, the prospect
             detail). An agent who signed HIMSELF up has no card at all
             (signupRep creates a User + PortalRep and nothing else), so there
             is no record to mark and the chip stays a plain link — flagged for
             founder confirmation in PROGRESS. */
          agentProspect: {
            select: { id: true, whatsappSentAt: true, whatsappSentByLabel: true },
          },
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

/** V2 §2.2/§2.3 — the unified leads/board source with the owner-bucket filter.
    ADR-067: `brand` FIRST and required, no default — see adminHome above. This
    is the query behind BOTH the B-Systems board and its Leads table, which are
    the two screens the company switch changes, so the company must arrive from
    the caller that resolved it.
    ADR-043: archived leads are hidden by default; the Leads page's Archived
    view passes { archived: true } — that IS the archive.
    Founder: `search` narrows by name / company / number and `type` by lead
    type — both server-side, shared with the board (§2.3). */
export function listBsLeads(
  brand: Brand,
  ownerType?: string,
  opts?: { archived?: boolean; search?: string; type?: string },
) {
  return db.lead.findMany({
    where: {
      brand,
      archived: opts?.archived ?? false,
      /* ADR-051 — "unassigned" is not an owner BUCKET, it is the absence of an
         owner inside the internal one (A-6): no rep, no account. It is where a
         data-entry user's leads land and wait for the admin to decide. */
      ...(ownerType === "unassigned"
        ? { ownerType: "internal", salesRepId: null, ownerUserId: null }
        : ownerType && ownerType !== "any"
          ? { ownerType }
          : {}),
      ...leadSearchWhere(opts?.search),
      ...leadTypeWhere(opts?.type),
    },
    include: {
      owner: { select: { name: true } },
      salesRep: { select: { name: true } },
      partner: { select: { companyName: true } },
      followUps: { orderBy: { createdAt: "desc" }, take: 1 },
      meetings: { orderBy: { createdAt: "desc" }, take: 1 },
      proposals: { orderBy: { createdAt: "desc" }, take: 1 },
      lostInfo: { orderBy: { createdAt: "desc" }, take: 1 },
      /* founder: the negotiation card shows its response-due date, but only
         when that follow-up is NEWER than the note the stage was entered with */
      negotiationNotes: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/** Owner's own board (agent/partner) — same search/type narrowing as the
    admin board, so agents filter their own cards exactly like the admin. */
export function listOwnLeads(
  brand: Brand,
  userId: string,
  opts?: { search?: string; type?: string },
) {
  return db.lead.findMany({
    where: {
      brand,
      ownerUserId: userId,
      archived: false,
      ...leadSearchWhere(opts?.search),
      ...leadTypeWhere(opts?.type),
    },
    include: {
      owner: { select: { name: true } },
      salesRep: { select: { name: true } },
      partner: { select: { companyName: true } },
      followUps: { orderBy: { createdAt: "desc" }, take: 1 },
      meetings: { orderBy: { createdAt: "desc" }, take: 1 },
      proposals: { orderBy: { createdAt: "desc" }, take: 1 },
      lostInfo: { orderBy: { createdAt: "desc" }, take: 1 },
      /* founder: the negotiation card shows its response-due date, but only
         when that follow-up is NEWER than the note the stage was entered with */
      negotiationNotes: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

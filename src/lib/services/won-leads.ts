import { db } from "@/lib/db";
import type { Brand } from "@/lib/pipeline-engine/constants";
import { ApiError } from "@/lib/api-error";
import { validateAndStore } from "@/lib/storage";
import { writeLog, type Actor } from "./activity";

/* V2 §4/§5 — Won Leads on the unified Lead model.
   Admin card: lead name, value, closer, milestone checks; detail adds proposal/
   contract PDF uploads, client details, contract date.
   Closer card: client CRM data + milestone progress; per-milestone commission is
   VISIBLE for agents/partners and HIDDEN for internal sales (V2 §4). */

export interface WonMilestoneView {
  id: string;
  index: number;
  label: string;
  value: number;
  /** null when hidden (internal sales) or locked (sequential disclosure) */
  commissionValue: number | null;
  expectedStart: Date | null;
  expectedEnd: Date | null;
  completed: boolean;
  locked: boolean;
}

function closerLabelFor(lead: {
  ownerType: string;
  owner: { name: string } | null;
  salesRep: { name: string } | null;
}): string {
  if (lead.owner) return lead.owner.name;
  if (lead.salesRep) return lead.salesRep.name;
  return lead.ownerType === "admin" ? "Admin" : "Unassigned";
}

const WON_INCLUDE = {
  lead: {
    include: {
      owner: { select: { id: true, name: true } },
      salesRep: { select: { name: true } },
    },
  },
  milestones: { orderBy: { index: "asc" as const } },
  attachments: true,
};

function milestoneViews(
  milestones: Array<{
    id: string;
    index: number;
    label: string | null;
    value: number;
    commissionValue: number | null;
    expectedStart: Date | null;
    expectedEnd: Date | null;
    completed: boolean;
  }>,
  opts: { showCommission: boolean; redactLocked: boolean },
): WonMilestoneView[] {
  return milestones.map((m, i) => {
    const previous = milestones[i - 1];
    const unlocked = m.index === 1 || Boolean(previous?.completed);
    const locked = !unlocked;
    return {
      id: m.id,
      index: m.index,
      label: m.label ?? `Milestone ${m.index}`,
      value: m.value,
      commissionValue:
        opts.showCommission && (!opts.redactLocked || !locked) ? m.commissionValue : null,
      expectedStart: m.expectedStart,
      expectedEnd: m.expectedEnd,
      completed: m.completed,
      locked,
    };
  });
}

/** Admin section (V2 §2.4) — every won lead of this company.

    ADR-067 — `brand` is a REQUIRED FIRST POSITIONAL with no default. The merged
    shell serves both companies from one address, so the row set has to follow
    the company the PAGE resolved; a literal buried in here would mean the
    screen renders whatever this file was last edited to believe. A default
    value would put the hole straight back, because a forgotten argument would
    silently be the old literal instead of a compiler error. */
export async function adminWonLeads(brand: Brand) {
  const wonDeals = await db.wonDeal.findMany({
    where: { lead: { brand } },
    include: WON_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return wonDeals.map((w) => ({
    id: w.id,
    lead: w.lead,
    closer: closerLabelFor(w.lead),
    estimatedValue: w.estimatedValue,
    totalCommissionPercent: w.totalCommissionPercent,
    contractDate: w.contractDate,
    attachments: w.attachments,
    milestones: milestoneViews(w.milestones, { showCommission: true, redactLocked: false }),
  }));
}

/** Closer section (V2 §4) — their own won leads; commission per role.

    ADR-067 — this query used to filter on `ownerUserId` ALONE, with no company
    predicate anywhere in it. It returned the right rows only by luck: a
    ByteForce lead has never carried an `ownerUserId` (createLead leaves it null
    and only assignLeadOwner sets it, which is B-Systems-locked). That is an
    accident of today's write paths, not a rule — and this is a commission
    screen, so the day anything assigns a ByteForce lead the accident becomes a
    cross-company disclosure of money. The company is now part of the WHERE. */
export async function closerWonLeads(
  brand: Brand,
  userId: string,
  opts: { showCommission: boolean },
) {
  const wonDeals = await db.wonDeal.findMany({
    where: { lead: { brand, ownerUserId: userId } },
    include: WON_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return wonDeals.map((w) => ({
    id: w.id,
    lead: w.lead,
    estimatedValue: w.estimatedValue,
    totalCommissionPercent: opts.showCommission ? w.totalCommissionPercent : null,
    milestones: milestoneViews(w.milestones, {
      showCommission: opts.showCommission,
      redactLocked: true,
    }),
  }));
}

/** Internal-sales view: won leads they are the assigned rep for, commission hidden. */
export async function salesWonLeads(brand: Brand) {
  const wonDeals = await db.wonDeal.findMany({
    where: { lead: { brand, ownerType: "internal" } },
    include: WON_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return wonDeals.map((w) => ({
    id: w.id,
    lead: w.lead,
    estimatedValue: w.estimatedValue,
    totalCommissionPercent: null, // V2 §4 — sales never sees commission
    milestones: milestoneViews(w.milestones, { showCommission: false, redactLocked: true }),
  }));
}

/** V2 §5 — proposal/contract PDF uploads on a won lead (admin). */
/* ADR-074 — `brand` is REQUIRED, and it is the same lesson ADR-073 learned on
   `checkMilestone`: this used to look a deal up by id ALONE, which was proof of
   ownership while one company had won deals and proof of nothing the moment two
   did. A B-Systems admin who guessed a Mindoo deal's id could have attached a
   contract to it. 404, never 403 — an id the caller may not touch must not be
   confirmed to exist. */
export async function addWonDocument(
  wonDealId: string,
  brand: Brand,
  kind: "proposal" | "contract",
  file: File,
  actor: Actor,
) {
  const wonDeal = await db.wonDeal.findUnique({
    where: { id: wonDealId },
    include: { lead: { select: { brand: true } } },
  });
  if (!wonDeal || wonDeal.lead.brand !== brand) throw new ApiError(404, "Won lead not found");
  const stored = await validateAndStore("cv", file); // pdf/doc rules fit contracts too
  return db.$transaction(async (tx) => {
    const attachment = await tx.attachment.create({
      data: {
        kind,
        wonDealId,
        filename: stored.filename,
        storageKey: stored.key,
        mime: stored.mime,
        size: stored.size,
      },
    });
    await writeLog(tx, {
      entityType: "won_deal",
      entityId: wonDealId,
      actor,
      action: "update",
      trigger: `${kind}_uploaded`,
    });
    return attachment;
  });
}

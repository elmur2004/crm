import { db } from "@/lib/db";
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

/** Admin section (V2 §2.4) — every won B-Systems lead. */
export async function adminWonLeads() {
  const wonDeals = await db.wonDeal.findMany({
    where: { lead: { brand: "bsystems" } },
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

/** Closer section (V2 §4) — their own won leads; commission per role. */
export async function closerWonLeads(userId: string, opts: { showCommission: boolean }) {
  const wonDeals = await db.wonDeal.findMany({
    where: { lead: { ownerUserId: userId } },
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
export async function salesWonLeads() {
  const wonDeals = await db.wonDeal.findMany({
    where: { lead: { brand: "bsystems", ownerType: "internal" } },
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
export async function addWonDocument(
  wonDealId: string,
  kind: "proposal" | "contract",
  file: File,
  actor: Actor,
) {
  const wonDeal = await db.wonDeal.findUnique({ where: { id: wonDealId } });
  if (!wonDeal) throw new ApiError(404, "Won lead not found");
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

import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import { MAX_PIASTERS } from "@/lib/money";
import { writeLog, type Actor } from "./activity";

/* §8.5.3 + P-7/P-8 — Won Deal management (ADMIN ONLY; the API layer guards, and
   these functions are only reachable from admin routes). Defining N milestones
   generates N checkboxes; checking milestone i unlocks i+1 for the rep in real
   time (the rep's serializer + polling do the disclosure); unchecking is the
   sanctioned correction path (ADR-020) and is logged (P-8). A-11: milestone
   values that don't sum to the estimated value produce a NON-BLOCKING warning. */

const money = z.number().int().min(0).max(MAX_PIASTERS);

export const wonDealValuesSchema = z.object({
  estimatedValue: money.nullable().optional(),
  totalCommission: money.nullable().optional(),
});

export async function updateWonDealValues(
  wonDealId: string,
  input: z.infer<typeof wonDealValuesSchema>,
  actor: Actor,
) {
  const wonDeal = await db.wonDeal.findUnique({ where: { id: wonDealId } });
  if (!wonDeal) throw new ApiError(404, "Won deal not found");
  return db.$transaction(async (tx) => {
    const updated = await tx.wonDeal.update({
      where: { id: wonDeal.id },
      data: {
        ...(input.estimatedValue !== undefined && { estimatedValue: input.estimatedValue }),
        ...(input.totalCommission !== undefined && { totalCommission: input.totalCommission }),
      },
    });
    await writeLog(tx, {
      entityType: "won_deal",
      entityId: wonDeal.id,
      actor,
      action: "won_deal_update",
      trigger: "P-7",
    });
    return updated;
  });
}

export const defineMilestonesSchema = z.object({
  values: z.array(money).min(1).max(100), // unlimited in spirit; 100 is a sanity rail
});

/** P-7: (re)defines the milestone set. Redefinition only while none are checked. */
export async function defineMilestones(
  wonDealId: string,
  input: z.infer<typeof defineMilestonesSchema>,
  actor: Actor,
): Promise<{ warning: string | null }> {
  const wonDeal = await db.wonDeal.findUnique({
    where: { id: wonDealId },
    include: { milestones: true },
  });
  if (!wonDeal) throw new ApiError(404, "Won deal not found");
  if (wonDeal.milestones.some((m) => m.completed)) {
    throw new ApiError(400, "Milestones already in progress — uncheck them first to redefine");
  }

  await db.$transaction(async (tx) => {
    await tx.milestone.deleteMany({ where: { wonDealId } });
    for (const [i, value] of input.values.entries()) {
      await tx.milestone.create({ data: { wonDealId, index: i + 1, value } });
    }
    await writeLog(tx, {
      entityType: "won_deal",
      entityId: wonDealId,
      actor,
      action: "milestone_define",
      trigger: "P-7",
    });
  });

  /* A-11: non-blocking sum warning. */
  const sum = input.values.reduce((a, b) => a + b, 0);
  const warning =
    wonDeal.estimatedValue != null && sum !== wonDeal.estimatedValue
      ? "Milestone values do not sum to the estimated value"
      : null;
  return { warning };
}

/** P-8: checking milestone i unlocks i+1; order is sequential. */
export async function checkMilestone(milestoneId: string, actor: Actor) {
  const milestone = await db.milestone.findUnique({ where: { id: milestoneId } });
  if (!milestone) throw new ApiError(404, "Milestone not found");
  if (milestone.completed) return;

  const previous = await db.milestone.findFirst({
    where: { wonDealId: milestone.wonDealId, index: milestone.index - 1 },
  });
  if (previous && !previous.completed) {
    throw new ApiError(400, "Complete the previous milestone first");
  }

  await db.$transaction(async (tx) => {
    await tx.milestone.update({
      where: { id: milestone.id },
      data: { completed: true, completedAt: new Date() },
    });
    await writeLog(tx, {
      entityType: "won_deal",
      entityId: milestone.wonDealId,
      actor,
      action: "milestone_check",
      trigger: "P-8",
    });
  });
}

/** P-8's logged reversal (ADR-020): only the LAST completed milestone can be unchecked. */
export async function uncheckMilestone(milestoneId: string, actor: Actor) {
  const milestone = await db.milestone.findUnique({ where: { id: milestoneId } });
  if (!milestone) throw new ApiError(404, "Milestone not found");
  if (!milestone.completed) return;

  const next = await db.milestone.findFirst({
    where: { wonDealId: milestone.wonDealId, index: milestone.index + 1 },
  });
  if (next?.completed) {
    throw new ApiError(400, "Uncheck the later milestone first");
  }

  await db.$transaction(async (tx) => {
    await tx.milestone.update({
      where: { id: milestone.id },
      data: { completed: false, completedAt: null },
    });
    await writeLog(tx, {
      entityType: "won_deal",
      entityId: milestone.wonDealId,
      actor,
      action: "milestone_uncheck",
      trigger: "P-8",
    });
  });
}

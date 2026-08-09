import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import { writeLog, type Actor } from "./activity";

/* V2 §4/§7 — milestone progress (ADMIN ONLY at the API layer). Milestones are
   created by the confirm-win tab (leads service); checking milestone i unlocks
   i+1 for the closer (sequential); unchecking is the logged correction path
   (ADR-020). A checked milestone becomes payable in Statements (V2 §7). */

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

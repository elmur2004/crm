import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import type { Brand } from "@/lib/pipeline-engine/constants";
import { writeLog, type Actor } from "./activity";
import { invalidateUndo } from "./undo";

/* V2 §4/§7 — milestone progress (ADMIN ONLY at the API layer). Milestones are
   created by the confirm-win tab (leads service); checking milestone i unlocks
   i+1 for the closer (sequential); unchecking is the logged correction path
   (ADR-020). A checked milestone becomes payable in Statements (V2 §7). */

/* ADR-073 — THE COMPANY WALL, and it is new because a third company made it
   necessary. Both of these looked the id up and nothing else, which was safe
   while exactly one company had milestones: the route's `requireBsAdmin` was
   the whole test. Mindoo wins the same way and therefore has milestones too, so
   an id alone stopped being proof of anything — a B-Systems admin could have
   checked a MINDOO milestone through /api/b-systems, and Mindoo's staff a
   B-Systems one through its own namespace. Neither route could have caught it;
   the record's own company is the only thing that can.

   `brand` is REQUIRED, not optional: an optional wall is a wall the next call
   site forgets, and the compiler naming both existing callers is the cheapest
   possible audit. */
async function requireMilestoneOfBrand(milestoneId: string, brand: Brand) {
  const milestone = await db.milestone.findUnique({
    where: { id: milestoneId },
    include: { wonDeal: { select: { lead: { select: { brand: true } } } } },
  });
  /* 404 rather than 403 on a foreign company's milestone: a 403 would confirm
     the id exists and let one company enumerate another's records. */
  if (!milestone || milestone.wonDeal?.lead?.brand !== brand) {
    throw new ApiError(404, "Milestone not found");
  }
  return milestone;
}

/** P-8: checking milestone i unlocks i+1; order is sequential. */
export async function checkMilestone(milestoneId: string, brand: Brand, actor: Actor) {
  const milestone = await requireMilestoneOfBrand(milestoneId, brand);
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
    await invalidateUndo(tx, actor); // ADR-045: money moves are never undoable
  });
}

/** P-8's logged reversal (ADR-020): only the LAST completed milestone can be unchecked. */
export async function uncheckMilestone(milestoneId: string, brand: Brand, actor: Actor) {
  const milestone = await requireMilestoneOfBrand(milestoneId, brand);
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
    await invalidateUndo(tx, actor); // ADR-045: money moves are never undoable
  });
}

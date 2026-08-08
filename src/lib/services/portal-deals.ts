import { z } from "zod";
import { db } from "@/lib/db";
import { portalConfig } from "@/lib/pipeline-engine/configs/portal";
import { transition } from "@/lib/pipeline-engine/transition";
import type { EngineEvent } from "@/lib/pipeline-engine/types";
import type { Role } from "@/lib/pipeline-engine/constants";
import { ApiError } from "@/lib/api-error";
import { groupPayloadSchema, type GroupPayload } from "./groups";
import { persistGroup } from "./leads";
import { writeLog, type Actor } from "./activity";

/* App C portal deals (§8.2, §10.3). applyDealEvent is the single write path —
   drag (P-1/P-2), next action (P-3), proposal sent (P-4), meeting outcomes (P-5),
   admin Won (P-6 → WonDeal side effect). The WON RESTRICTION LIVES IN THE ENGINE
   (portalConfig.wonRoles) and is re-validated here on every event — never only UI. */

export const createDealSchema = z.object({
  name: z.string().min(1).max(200),
  position: z.string().min(1).max(200),
  number: z.string().min(1).max(50),
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  companyName: z.string().min(1).max(200),
  industry: z.string().min(1).max(200),
  requirements: z.string().max(4000).optional(),
});

export const updateDealSchema = createDealSchema.partial();

export async function createDeal(
  repId: string,
  input: z.infer<typeof createDealSchema>,
  actor: Actor,
) {
  return db.$transaction(async (tx) => {
    const deal = await tx.portalDeal.create({
      data: {
        repId,
        name: input.name,
        position: input.position,
        number: input.number,
        email: input.email ?? null,
        companyName: input.companyName,
        industry: input.industry,
        requirements: input.requirements ?? null,
      },
    });
    await writeLog(tx, {
      entityType: "portal_deal",
      entityId: deal.id,
      actor,
      action: "create",
      toStage: "leads",
      trigger: "create",
    });
    return deal;
  });
}

export async function updateDeal(
  dealId: string,
  input: z.infer<typeof updateDealSchema>,
  actor: Actor,
) {
  const deal = await db.portalDeal.findUnique({ where: { id: dealId } });
  if (!deal) throw new ApiError(404, "Deal not found");
  return db.$transaction(async (tx) => {
    const updated = await tx.portalDeal.update({
      where: { id: deal.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.position !== undefined && { position: input.position }),
        ...(input.number !== undefined && { number: input.number }),
        ...(input.email !== undefined && { email: input.email ?? null }),
        ...(input.companyName !== undefined && { companyName: input.companyName }),
        ...(input.industry !== undefined && { industry: input.industry }),
        ...(input.requirements !== undefined && { requirements: input.requirements ?? null }),
      },
    });
    await writeLog(tx, {
      entityType: "portal_deal",
      entityId: deal.id,
      actor,
      action: "update",
      trigger: "edit",
    });
    return updated;
  });
}

/** Rep board: own deals only — a non-null repId is the caller's job to guarantee
    (§3 isolation; pages redirect when the profile is missing). */
export function listDeals(repId: string) {
  if (!repId) throw new ApiError(403, "No portal profile on this account");
  return db.portalDeal.findMany({
    where: { repId },
    include: {
      rep: { select: { firstName: true, lastName: true } },
      followUps: { orderBy: { createdAt: "desc" }, take: 1 },
      meetings: { orderBy: { createdAt: "desc" }, take: 1 },
      proposals: { orderBy: { createdAt: "desc" }, take: 1 },
      lostInfo: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getDealDetail(dealId: string) {
  const deal = await db.portalDeal.findUnique({
    where: { id: dealId },
    include: {
      rep: { select: { id: true, firstName: true, lastName: true } },
      followUps: { orderBy: { createdAt: "asc" }, include: { ownerPortalRep: true } },
      meetings: { orderBy: { createdAt: "asc" } },
      proposals: { orderBy: { createdAt: "asc" } },
      lostInfo: { orderBy: { createdAt: "asc" } },
      wonDeal: true,
    },
  });
  if (!deal) throw new ApiError(404, "Deal not found");
  const history = await db.activityLog.findMany({
    where: { entityType: "portal_deal", entityId: dealId },
    orderBy: { createdAt: "desc" },
  });
  return { deal, history };
}

export const dealEventSchema = z.object({
  event: z.discriminatedUnion("type", [
    z.object({ type: z.literal("next_action"), action: z.string() }),
    z.object({ type: z.literal("drag"), to: z.string() }),
    z.object({ type: z.literal("proposal_sent") }),
    z.object({
      type: z.literal("meeting_outcome"),
      outcome: z.enum(["attended", "cancelled", "delayed"]),
      destination: z.string().optional(),
    }),
    z.object({ type: z.literal("admin_won") }),
  ]),
  group: groupPayloadSchema.optional(),
});

export async function applyDealEvent(opts: {
  dealId: string;
  event: EngineEvent;
  group?: GroupPayload;
  actor: Actor;
  role: Role;
}): Promise<{ toStage: string }> {
  const deal = await db.portalDeal.findUnique({ where: { id: opts.dealId } });
  if (!deal) throw new ApiError(404, "Deal not found");

  const result = transition(portalConfig, { stage: deal.stage }, opts.event, { role: opts.role });
  if (!result.ok) {
    // P-2: "Blocked with clear message: only admin can mark Won"
    throw new ApiError(result.code === "won_forbidden" ? 403 : 400, result.message);
  }

  if (result.requiredGroup) {
    if (!opts.group || opts.group.group !== result.requiredGroup.group) {
      throw new ApiError(400, `This move requires the "${result.requiredGroup.group}" fields`);
    }
    opts.group = groupPayloadSchema.parse(opts.group);
  }

  await db.$transaction(async (tx) => {
    const fresh = await tx.portalDeal.findUniqueOrThrow({
      where: { id: deal.id },
      select: { stage: true },
    });
    if (fresh.stage !== deal.stage) {
      throw new ApiError(409, "This deal just moved — reload and try again");
    }

    if (opts.event.type === "proposal_sent") {
      const unsent = await tx.proposal.findFirst({
        where: { portalDealId: deal.id, sent: false },
        orderBy: { createdAt: "desc" },
      });
      if (!unsent) throw new ApiError(400, "No unsent proposal on this deal");
      await tx.proposal.update({
        where: { id: unsent.id },
        data: { sent: true, sentAt: new Date() },
      });
    }
    if (opts.event.type === "meeting_outcome") {
      const meeting = await tx.meeting.findFirst({
        where: { portalDealId: deal.id },
        orderBy: { createdAt: "desc" },
      });
      if (!meeting) throw new ApiError(400, "No meeting recorded on this deal");
      await tx.meeting.update({
        where: { id: meeting.id },
        data: { outcome: opts.event.outcome, outcomeDestination: opts.event.destination ?? null },
      });
    }

    await persistGroup(tx, { portalDealId: deal.id }, result.requiredGroup?.group ?? null, opts.group, {
      followUpContext:
        result.requiredGroup?.group === "follow_up" ? result.requiredGroup.context : undefined,
    });

    if (result.toStage !== deal.stage) {
      await tx.portalDeal.update({ where: { id: deal.id }, data: { stage: result.toStage } });
    }

    for (const effect of result.sideEffects) {
      if (effect === "create_won_deal") {
        // P-6: WonDeal auto-created; identity fields read via the deal relation (§8.3)
        const existing = await tx.wonDeal.findUnique({ where: { dealId: deal.id } });
        if (!existing) {
          const wonDeal = await tx.wonDeal.create({ data: { dealId: deal.id } });
          await writeLog(tx, {
            entityType: "won_deal",
            entityId: wonDeal.id,
            actor: opts.actor,
            action: "create",
            trigger: "P-6",
          });
        }
      }
    }

    await writeLog(tx, {
      entityType: "portal_deal",
      entityId: deal.id,
      actor: opts.actor,
      action: result.auto ? "auto_transfer" : "stage_change",
      fromStage: result.fromStage,
      toStage: result.toStage,
      trigger: result.logTrigger,
    });
  });

  return { toStage: result.toStage };
}

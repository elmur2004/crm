import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "../../../generated/prisma/client";
import { internalCrmConfig } from "@/lib/pipeline-engine/configs/internal-crm";
import { bsystemsCrmConfig } from "@/lib/pipeline-engine/configs/bsystems-crm";
import { transition } from "@/lib/pipeline-engine/transition";
import type { EngineEvent, PipelineConfig } from "@/lib/pipeline-engine/types";
import {
  LEAD_TYPES,
  type Brand,
  type OwnerType,
  type Role,
} from "@/lib/pipeline-engine/constants";
import { ApiError } from "@/lib/api-error";
import { cairoToUtc } from "@/lib/datetime";
import {
  followUpDueAt,
  groupPayloadSchema,
  type GroupPayload,
  type WonDealInput,
} from "./groups";
import { writeLog, type Actor } from "./activity";
import { notifyAdmins } from "./notifications";

/* V2 (ADR-030): ByteForce keeps the v1 pipeline; B-Systems runs the unified
   role-aware pipeline (negotiation stage, milestone-tab win, owner buckets). */
export function configForBrand(brand: Brand): PipelineConfig {
  return brand === "byteforce" ? internalCrmConfig : bsystemsCrmConfig;
}

/* Lead lifecycle for Apps A & B (§6.1–§6.4, §10.1). applyLeadEvent is the single
   write path for every pipeline move: engine-validated, group-gated, atomic, and
   activity-logged (T-10). Brand always comes from the route (never client input). */

export const createLeadSchema = z.object({
  salesRepId: z.string().optional(), // A-6: optional for partner-sourced leads
  name: z.string().min(1).max(200),
  number: z.string().min(1).max(50),
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  type: z.enum(LEAD_TYPES),
  description: z.string().max(2000).optional(),
  // V2 §1 — ex-portal deal fields, optional on every lead
  position: z.string().max(200).optional(),
  companyName: z.string().max(200).optional(),
  industry: z.string().max(200).optional(),
  requirements: z.string().max(4000).optional(),
});

export const updateLeadSchema = createLeadSchema.partial();

export async function createLead(
  brand: Brand,
  input: z.infer<typeof createLeadSchema>,
  actor: Actor,
  opts?: {
    attribution?: { partnerId: string };
    /* V2 §1 owner bucket: who this lead belongs to. Defaults to internal. */
    ownerType?: OwnerType;
    ownerUserId?: string;
  },
) {
  if (input.salesRepId) {
    const rep = await db.salesRep.findFirst({ where: { id: input.salesRepId, brand } });
    if (!rep) throw new ApiError(404, "Sales rep not found");
  }
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        brand,
        ownerType: opts?.ownerType ?? "internal",
        ownerUserId: opts?.ownerUserId ?? null,
        salesRepId: input.salesRepId ?? null,
        name: input.name,
        number: input.number,
        email: input.email ?? null,
        type: input.type,
        description: input.description ?? null,
        position: input.position ?? null,
        companyName: input.companyName ?? null,
        industry: input.industry ?? null,
        requirements: input.requirements ?? null,
        source: opts?.attribution ? "partner" : "direct",
        partnerId: opts?.attribution?.partnerId ?? null, // §5.5 — permanent
      },
    });
    await writeLog(tx, {
      entityType: "lead",
      entityId: lead.id,
      actor,
      action: "create",
      toStage: "new",
      trigger: opts?.attribution ? "PP-5" : "create",
    });
    return lead;
  });
}

/* V2 §3 — the always-available "Mark ready to close" flag: card marker + admin
   notification; not a stage transition. */
export async function markReadyToClose(brand: Brand, leadId: string, actor: Actor) {
  const lead = await getLead(brand, leadId);
  if (lead.readyToClose) return lead;
  const updated = await db.$transaction(async (tx) => {
    const fresh = await tx.lead.update({
      where: { id: lead.id },
      data: { readyToClose: true },
    });
    await writeLog(tx, {
      entityType: "lead",
      entityId: lead.id,
      actor,
      action: "update",
      trigger: "B-RTC",
    });
    return fresh;
  });
  await notifyAdmins({
    type: "ready_to_close",
    title: `Ready to close: ${lead.name}`,
    body: `${actor.label} marked "${lead.name}" as ready to close (stage: ${lead.stage}).`,
    leadId: lead.id,
  });
  return updated;
}

/* V2 §11 — admin delete (hard delete; children cascade). */
export async function deleteLead(brand: Brand, leadId: string, actor: Actor) {
  const lead = await getLead(brand, leadId);
  const wonDeal = await db.wonDeal.findUnique({ where: { leadId: lead.id } });
  if (wonDeal) throw new ApiError(400, "Won leads cannot be deleted — they carry milestones");
  await db.$transaction(async (tx) => {
    await tx.lead.delete({ where: { id: lead.id } });
    await writeLog(tx, {
      entityType: "lead",
      entityId: lead.id,
      actor,
      action: "update",
      trigger: "deleted",
    });
  });
}

export async function updateLead(
  brand: Brand,
  leadId: string,
  input: z.infer<typeof updateLeadSchema>,
  actor: Actor,
) {
  const lead = await getLead(brand, leadId);
  if (input.salesRepId) {
    const rep = await db.salesRep.findFirst({ where: { id: input.salesRepId, brand } });
    if (!rep) throw new ApiError(404, "Sales rep not found");
  }
  return db.$transaction(async (tx) => {
    const updated = await tx.lead.update({
      where: { id: lead.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.number !== undefined && { number: input.number }),
        ...(input.email !== undefined && { email: input.email ?? null }),
        ...(input.type !== undefined && { type: input.type }),
        ...(input.description !== undefined && { description: input.description ?? null }),
        ...(input.salesRepId !== undefined && { salesRepId: input.salesRepId }),
      },
    });
    await writeLog(tx, {
      entityType: "lead",
      entityId: lead.id,
      actor,
      action: "update",
      trigger: "edit",
    });
    return updated;
  });
}

export async function getLead(brand: Brand, leadId: string) {
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.brand !== brand) throw new ApiError(404, "Lead not found");
  return lead;
}

export async function getLeadDetail(brand: Brand, leadId: string) {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: {
      salesRep: true,
      partner: { select: { id: true, companyName: true } },
      followUps: { orderBy: { createdAt: "asc" }, include: { ownerSalesRep: true } },
      meetings: { orderBy: { createdAt: "asc" } },
      proposals: { orderBy: { createdAt: "asc" } },
      lostInfo: { orderBy: { createdAt: "asc" } },
      wonInfo: true,
      client: true,
    },
  });
  if (!lead || lead.brand !== brand) throw new ApiError(404, "Lead not found");
  const history = await db.activityLog.findMany({
    where: { entityType: "lead", entityId: leadId },
    orderBy: { createdAt: "desc" },
  });
  return { lead, history };
}

/** ADR-012: a card's Estimated value = latest proposal's value (0/null if none). */
export function latestProposalValue(
  proposals: Array<{ estimatedValue: number | null; createdAt: Date }>,
): number | null {
  if (proposals.length === 0) return null;
  const latest = proposals.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
  return latest.estimatedValue;
}

export const leadEventSchema = z.object({
  event: z.discriminatedUnion("type", [
    z.object({ type: z.literal("next_action"), action: z.string() }),
    z.object({ type: z.literal("drag"), to: z.string() }), // V2 §2.3 board
    z.object({ type: z.literal("proposal_sent") }),
    z.object({
      type: z.literal("meeting_outcome"),
      outcome: z.enum(["attended", "cancelled", "delayed"]),
      destination: z.string().optional(),
    }),
  ]),
  group: groupPayloadSchema.optional(),
});

export async function applyLeadEvent(opts: {
  brand: Brand;
  leadId: string;
  event: EngineEvent;
  group?: GroupPayload;
  actor: Actor;
  role: Role;
}): Promise<{ toStage: string }> {
  const lead = await getLead(opts.brand, opts.leadId);
  const config = configForBrand(opts.brand);

  const result = transition(config, { stage: lead.stage }, opts.event, { role: opts.role });
  if (!result.ok) {
    throw new ApiError(result.code === "won_forbidden" ? 403 : 400, result.message);
  }

  /* Required group payload is mandatory and must match the engine's demand.
     Re-parsed here (not only at the API boundary) — the group schemas ARE the
     completeness gates. */
  if (result.requiredGroup) {
    if (!opts.group || opts.group.group !== result.requiredGroup.group) {
      throw new ApiError(400, `This move requires the "${result.requiredGroup.group}" fields`);
    }
    opts.group = groupPayloadSchema.parse(opts.group);
  }

  /* V2 §3: an agent's meeting submission notifies the admins (after the tx). */
  const notifyMeeting =
    opts.brand === "bsystems" &&
    (opts.role === "bsystems_agent" || opts.role === "bsystems_partner") &&
    result.requiredGroup?.group === "meeting" &&
    opts.group?.group === "meeting"
      ? opts.group.data
      : null;

  await db.$transaction(async (tx) => {
    /* Concurrency guard: the stage the engine validated must still be current
       inside the transaction (double-submit / racing tabs → 409). */
    const fresh = await tx.lead.findUniqueOrThrow({
      where: { id: lead.id },
      select: { stage: true },
    });
    if (fresh.stage !== lead.stage) {
      throw new ApiError(409, "This lead just moved — reload and try again");
    }

    /* Event-specific pre-writes on existing records (§5.3 triggers). */
    if (opts.event.type === "proposal_sent") {
      const unsent = await tx.proposal.findFirst({
        where: { leadId: lead.id, sent: false },
        orderBy: { createdAt: "desc" },
      });
      if (!unsent) throw new ApiError(400, "No unsent proposal on this lead");
      await tx.proposal.update({
        where: { id: unsent.id },
        data: { sent: true, sentAt: new Date() },
      });
    }
    if (opts.event.type === "meeting_outcome") {
      const meeting = await tx.meeting.findFirst({
        where: { leadId: lead.id },
        orderBy: { createdAt: "desc" },
      });
      if (!meeting) throw new ApiError(400, "No meeting recorded on this lead");
      await tx.meeting.update({
        where: { id: meeting.id },
        data: {
          outcome: opts.event.outcome,
          outcomeDestination: opts.event.destination ?? null,
        },
      });
    }

    await persistGroup(tx, { leadId: lead.id }, result.requiredGroup?.group ?? null, opts.group, {
      followUpContext:
        result.requiredGroup?.group === "follow_up" ? result.requiredGroup.context : undefined,
    });

    if (result.toStage !== lead.stage) {
      await tx.lead.update({ where: { id: lead.id }, data: { stage: result.toStage } });
    }

    /* Side effects (atomic with the move). */
    for (const effect of result.sideEffects) {
      if (effect === "create_client") {
        await createClientFromWon(tx, lead.id, opts.brand, opts.actor);
      }
      if (effect === "create_won_deal") {
        // V2 §4: confirm-win consumes the won_deal milestone tab
        const tab = (opts.group as { group: "won_deal"; data: WonDealInput }).data;
        const wonDeal = await tx.wonDeal.create({
          data: {
            leadId: lead.id,
            estimatedValue: tab.estimatedValue,
            totalCommissionPercent: tab.totalCommissionPercentBp,
            contractDate: tab.contractDate
              ? new Date(`${tab.contractDate}T00:00:00.000Z`)
              : new Date(),
          },
        });
        for (const [i, m] of tab.milestones.entries()) {
          await tx.milestone.create({
            data: {
              wonDealId: wonDeal.id,
              index: i + 1,
              label: m.label ?? null,
              value: m.value,
              commissionValue: m.commissionValue,
              expectedStart: m.expectedStart
                ? new Date(`${m.expectedStart}T00:00:00.000Z`)
                : null,
              expectedEnd: m.expectedEnd ? new Date(`${m.expectedEnd}T00:00:00.000Z`) : null,
            },
          });
        }
        await writeLog(tx, {
          entityType: "won_deal",
          entityId: wonDeal.id,
          actor: opts.actor,
          action: "create",
          trigger: "B-9",
        });
      }
    }

    await writeLog(tx, {
      entityType: "lead",
      entityId: lead.id,
      actor: opts.actor,
      action: result.auto ? "auto_transfer" : "stage_change",
      fromStage: result.fromStage,
      toStage: result.toStage,
      trigger: result.logTrigger,
    });
  });

  if (notifyMeeting) {
    const when =
      notifyMeeting.date && notifyMeeting.time
        ? `${notifyMeeting.date} ${notifyMeeting.time}`
        : "no slot chosen";
    await notifyAdmins({
      type: "meeting_request",
      title: `Meeting request: ${lead.name}`,
      body:
        `${opts.actor.label} ${notifyMeeting.arranged ? "AGREED with the client" : "proposed a preferred slot"} — ` +
        `${when} · ${notifyMeeting.mode ?? "mode TBD"} · technical colleague: ${
          notifyMeeting.needsTechnical ? "yes" : "no"
        }`,
      leadId: lead.id,
    });
  }

  return { toStage: result.toStage };
}

/** Persists the required group's child record (shared with partners/portal services). */
export async function persistGroup(
  tx: Prisma.TransactionClient,
  parent: { leadId?: string; partnerProspectId?: string; portalDealId?: string },
  group: string | null,
  payload: GroupPayload | undefined,
  extra: { followUpContext?: "initial" | "after_proposal" | "after_meeting" },
): Promise<void> {
  if (!group || !payload) return;
  if (payload.group === "follow_up" && group === "follow_up") {
    await tx.followUp.create({
      data: {
        ...parent,
        context: extra.followUpContext ?? "initial",
        dueAt: followUpDueAt(payload.data),
        method: payload.data.method,
        ownerSalesRepId: payload.data.ownerSalesRepId ?? null,
        ownerPortalRepId: payload.data.ownerPortalRepId ?? null,
        followingUpWith: payload.data.followingUpWith ?? null,
      },
    });
  } else if (payload.group === "meeting" && group === "meeting") {
    await tx.meeting.create({
      data: {
        ...parent,
        arranged: payload.data.arranged,
        datetime:
          payload.data.arranged && payload.data.date && payload.data.time
            ? cairoToUtc(payload.data.date, payload.data.time)
            : null,
        mode: payload.data.mode ?? null,
        withAttendees: payload.data.withAttendees ?? null,
        technicalSupport: payload.data.technicalSupport ?? null,
      },
    });
  } else if (payload.group === "meeting_reschedule" && group === "meeting_reschedule") {
    const key = parent.leadId
      ? { leadId: parent.leadId }
      : parent.partnerProspectId
        ? { partnerProspectId: parent.partnerProspectId }
        : { portalDealId: parent.portalDealId };
    const meeting = await tx.meeting.findFirst({
      where: key as never,
      orderBy: { createdAt: "desc" },
    });
    if (!meeting) throw new ApiError(400, "No meeting to reschedule");
    await tx.meeting.update({
      where: { id: meeting.id },
      data: {
        datetime: cairoToUtc(payload.data.date, payload.data.time),
        outcome: null, // rescheduled — outcome pending again (T-7)
        outcomeDestination: null,
      },
    });
  } else if (payload.group === "proposal" && group === "proposal") {
    if (payload.data.sent) {
      // Sent is a separate event (T-5) so the auto-move always fires — see IMPLEMENTATION.md
      throw new ApiError(400, "Save the proposal first, then mark it as sent");
    }
    await tx.proposal.create({
      data: {
        ...parent,
        service: payload.data.service,
        estimatedValue: payload.data.estimatedValue ?? null,
        sent: false,
      },
    });
  } else if (payload.group === "lost" && group === "lost") {
    await tx.lostInfo.create({ data: { ...parent, reason: payload.data.reason } });
  } else if (payload.group === "won" && group === "won") {
    if (!parent.leadId) throw new ApiError(400, "Won group applies to leads");
    await tx.wonInfo.create({
      data: {
        leadId: parent.leadId,
        estimatedValue: payload.data.estimatedValue,
        technicalOwner: payload.data.technicalOwner,
        collectedAmount: payload.data.collectedAmount,
      },
    });
  } else if (group === "numbers") {
    // PP-1 (V2 §6): the dialed-number selection is consumed by the partners service
  } else if (group === "won_partner" && payload.group === "won_partner") {
    // PP-4: the gate data is consumed by the create_partner side effect, not a child record
  } else if (group === "won_deal" && payload.group === "won_deal") {
    // V2 §4: the milestone tab is consumed by the create_won_deal side effect
  } else if (group === "negotiation" && payload.group === "negotiation") {
    if (!parent.leadId) throw new ApiError(400, "Negotiation notes apply to leads");
    await tx.negotiationNote.create({
      data: { leadId: parent.leadId, note: payload.data.note },
    });
  } else {
    throw new ApiError(400, `Group payload "${payload.group}" does not match required "${group}"`);
  }
}

/* T-9 / A-1 — Client card auto-created/linked, mapped per the A-1 default. */
async function createClientFromWon(
  tx: Prisma.TransactionClient,
  leadId: string,
  brand: Brand,
  actor: Actor,
): Promise<void> {
  const lead = await tx.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: {
      wonInfo: true,
      proposals: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const won = lead.wonInfo;
  if (!won) throw new ApiError(400, "Won fields missing");
  const service = lead.proposals[0]?.service ?? null;
  const toBeCollected = won.estimatedValue - won.collectedAmount;

  const existing = await tx.client.findUnique({ where: { leadId } });
  const client = existing
    ? await tx.client.update({
        where: { leadId },
        data: {
          name: lead.name,
          number: lead.number,
          service,
          estimatedValue: won.estimatedValue,
          collected: won.collectedAmount,
          toBeCollected,
          technicalOwner: won.technicalOwner,
        },
      })
    : await tx.client.create({
        data: {
          brand,
          leadId,
          name: lead.name,
          number: lead.number,
          service,
          estimatedValue: won.estimatedValue,
          collected: won.collectedAmount,
          toBeCollected,
          technicalOwner: won.technicalOwner,
        },
      });
  await writeLog(tx, {
    entityType: "client",
    entityId: client.id,
    actor,
    action: "create",
    trigger: "T-9",
  });
}

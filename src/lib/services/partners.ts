import { z } from "zod";
import { db } from "@/lib/db";
import { partnersConfig } from "@/lib/pipeline-engine/configs/partners";
import { transition } from "@/lib/pipeline-engine/transition";
import type { EngineEvent } from "@/lib/pipeline-engine/types";
import type { Role } from "@/lib/pipeline-engine/constants";
import { ApiError } from "@/lib/api-error";
import { groupPayloadSchema, type GroupPayload, type WonPartnerInput } from "./groups";
import { persistGroup } from "./leads";
import { writeLog, type Actor } from "./activity";
import { validateAndStore } from "@/lib/storage";

/* App B Partners pipeline (§7.2–§7.3, §10.2). applyProspectEvent mirrors
   applyLeadEvent on the partners config; updateProspect fires PP-2's auto-return
   when a new number lands on a Didn't-Answer card; the PP-4 completeness gate is
   the won_partner Zod schema and conversion creates the directory Partner. */

export const createProspectSchema = z.object({
  name: z.string().min(1).max(200),
  companyName: z.string().min(1).max(200),
  role: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  number: z.string().min(1).max(50),
  businessActivity: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
});

export const updateProspectSchema = createProspectSchema.partial().extend({
  number2: z.string().max(50).optional(),
  number3: z.string().max(50).optional(),
});

export async function createProspect(
  input: z.infer<typeof createProspectSchema>,
  actor: Actor,
) {
  return db.$transaction(async (tx) => {
    const prospect = await tx.partnerProspect.create({
      data: {
        name: input.name,
        companyName: input.companyName,
        role: input.role ?? null,
        email: input.email ?? null,
        number: input.number,
        businessActivity: input.businessActivity,
        description: input.description ?? null,
      },
    });
    await writeLog(tx, {
      entityType: "partner_prospect",
      entityId: prospect.id,
      actor,
      action: "create",
      toStage: "lead",
      trigger: "create",
    });
    return prospect;
  });
}

export async function getProspect(prospectId: string) {
  const prospect = await db.partnerProspect.findUnique({ where: { id: prospectId } });
  if (!prospect) throw new ApiError(404, "Partner prospect not found");
  return prospect;
}

export async function getProspectDetail(prospectId: string) {
  const prospect = await db.partnerProspect.findUnique({
    where: { id: prospectId },
    include: {
      followUps: { orderBy: { createdAt: "asc" }, include: { ownerSalesRep: true } },
      meetings: { orderBy: { createdAt: "asc" } },
      lostInfo: { orderBy: { createdAt: "asc" } },
      recordings: { orderBy: { createdAt: "asc" } },
      partner: true,
    },
  });
  if (!prospect) throw new ApiError(404, "Partner prospect not found");
  const history = await db.activityLog.findMany({
    where: { entityType: "partner_prospect", entityId: prospectId },
    orderBy: { createdAt: "desc" },
  });
  return { prospect, history };
}

/**
 * §7.2 base-field edits + the PP-2 trigger: a non-empty value newly saved into
 * Number 2 or Number 3 while the card sits in Didn't Answer auto-returns it to
 * Lead ("Returned to Lead — new number added"). Max two extra numbers is
 * structural (only the two slots exist); overwriting a filled slot is an edit,
 * not a new number.
 */
export async function updateProspect(
  prospectId: string,
  input: z.infer<typeof updateProspectSchema>,
  actor: Actor,
  role: Role,
) {
  const prospect = await getProspect(prospectId);

  const newNumber2 = input.number2 !== undefined && input.number2 !== "" && !prospect.number2;
  const newNumber3 = input.number3 !== undefined && input.number3 !== "" && !prospect.number3;
  const firesPP2 = prospect.stage === "didnt_answer" && (newNumber2 || newNumber3);

  return db.$transaction(async (tx) => {
    /* Same stale-stage guard as applyProspectEvent — PP-2's from-stage must still
       hold inside the transaction. */
    const fresh = await tx.partnerProspect.findUniqueOrThrow({
      where: { id: prospect.id },
      select: { stage: true },
    });
    if (fresh.stage !== prospect.stage) {
      throw new ApiError(409, "This card just moved — reload and try again");
    }
    await tx.partnerProspect.update({
      where: { id: prospect.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.companyName !== undefined && { companyName: input.companyName }),
        ...(input.role !== undefined && { role: input.role ?? null }),
        ...(input.email !== undefined && { email: input.email ?? null }),
        ...(input.number !== undefined && { number: input.number }),
        ...(input.number2 !== undefined && { number2: input.number2 || null }),
        ...(input.number3 !== undefined && { number3: input.number3 || null }),
        ...(input.businessActivity !== undefined && { businessActivity: input.businessActivity }),
        ...(input.description !== undefined && { description: input.description ?? null }),
      },
    });

    if (firesPP2) {
      const result = transition(
        partnersConfig,
        { stage: prospect.stage },
        { type: "number_added", slot: newNumber2 ? 2 : 3 },
        { role },
      );
      if (!result.ok) throw new ApiError(400, result.message);
      await tx.partnerProspect.update({
        where: { id: prospect.id },
        data: { stage: result.toStage },
      });
      await writeLog(tx, {
        entityType: "partner_prospect",
        entityId: prospect.id,
        actor,
        action: "auto_transfer",
        fromStage: result.fromStage,
        toStage: result.toStage,
        trigger: "PP-2", // History: "Returned to Lead — new number added"
      });
    } else {
      await writeLog(tx, {
        entityType: "partner_prospect",
        entityId: prospect.id,
        actor,
        action: "update",
        trigger: "edit",
      });
    }
    return tx.partnerProspect.findUniqueOrThrow({ where: { id: prospect.id } });
  });
}

export const prospectEventSchema = z.object({
  event: z.discriminatedUnion("type", [
    z.object({ type: z.literal("next_action"), action: z.string() }),
    z.object({
      type: z.literal("meeting_outcome"),
      outcome: z.enum(["attended", "cancelled", "delayed"]),
      destination: z.string().optional(),
    }),
  ]),
  group: groupPayloadSchema.optional(),
});

export async function applyProspectEvent(opts: {
  prospectId: string;
  event: EngineEvent;
  group?: GroupPayload;
  actor: Actor;
  role: Role;
}): Promise<{ toStage: string }> {
  const prospect = await getProspect(opts.prospectId);

  const result = transition(partnersConfig, { stage: prospect.stage }, opts.event, {
    role: opts.role,
  });
  if (!result.ok) throw new ApiError(400, result.message);

  /* PP-4's completeness gate lives in the won_partner schema — re-parsed at the
     service layer so it can never be bypassed. The numbers group (PP-1) carries no
     payload: the fields are revealed, not collected, at move time. */
  if (result.requiredGroup && result.requiredGroup.group !== "numbers") {
    if (!opts.group || opts.group.group !== result.requiredGroup.group) {
      throw new ApiError(400, `This move requires the "${result.requiredGroup.group}" fields`);
    }
    opts.group = groupPayloadSchema.parse(opts.group);
  }

  await db.$transaction(async (tx) => {
    const fresh = await tx.partnerProspect.findUniqueOrThrow({
      where: { id: prospect.id },
      select: { stage: true },
    });
    if (fresh.stage !== prospect.stage) {
      throw new ApiError(409, "This card just moved — reload and try again");
    }

    if (opts.event.type === "meeting_outcome") {
      const meeting = await tx.meeting.findFirst({
        where: { partnerProspectId: prospect.id },
        orderBy: { createdAt: "desc" },
      });
      if (!meeting) throw new ApiError(400, "No meeting recorded on this prospect");
      await tx.meeting.update({
        where: { id: meeting.id },
        data: { outcome: opts.event.outcome, outcomeDestination: opts.event.destination ?? null },
      });
    }

    await persistGroup(
      tx,
      { partnerProspectId: prospect.id },
      result.requiredGroup?.group ?? null,
      opts.group,
      {
        followUpContext:
          result.requiredGroup?.group === "follow_up" ? result.requiredGroup.context : undefined,
      },
    );

    if (result.toStage !== prospect.stage) {
      await tx.partnerProspect.update({
        where: { id: prospect.id },
        data: { stage: result.toStage },
      });
    }

    for (const effect of result.sideEffects) {
      if (effect === "create_partner") {
        // PP-4: gate satisfied (won_partner schema) → Partner in the directory,
        // date_joined = now; card stays in Won with the Converted badge (A-5).
        const gate = (opts.group as { group: "won_partner"; data: WonPartnerInput }).data;
        const partner = await tx.partner.create({
          data: {
            prospectId: prospect.id,
            companyName: gate.companyName,
            keyPersonName: gate.keyPersonName,
            keyPersonRole: gate.keyPersonRole,
            address: gate.address,
            number: gate.number,
            email: gate.email ?? null,
            businessActivity: gate.businessActivity,
            importance: gate.importance,
          },
        });
        await tx.partnerProspect.update({
          where: { id: prospect.id },
          data: { converted: true },
        });
        await writeLog(tx, {
          entityType: "partner",
          entityId: partner.id,
          actor: opts.actor,
          action: "create",
          trigger: "PP-4",
        });
      }
    }

    await writeLog(tx, {
      entityType: "partner_prospect",
      entityId: prospect.id,
      actor: opts.actor,
      action: result.auto ? "auto_transfer" : "stage_change",
      fromStage: result.fromStage,
      toStage: result.toStage,
      trigger: result.logTrigger,
    });
  });

  return { toStage: result.toStage };
}

/* ---------- recordings (§7.2 cold-call recordings) ---------- */

export async function addRecording(prospectId: string, file: File, actor: Actor) {
  const prospect = await getProspect(prospectId);
  const stored = await validateAndStore("recording", file);
  return db.$transaction(async (tx) => {
    const attachment = await tx.attachment.create({
      data: {
        kind: "recording",
        partnerProspectId: prospect.id,
        filename: stored.filename,
        storageKey: stored.key,
        mime: stored.mime,
        size: stored.size,
      },
    });
    await writeLog(tx, {
      entityType: "partner_prospect",
      entityId: prospect.id,
      actor,
      action: "update",
      trigger: "recording_added",
    });
    return attachment;
  });
}

/* ---------- directory (§7.3–§7.4) ---------- */

export function listPartners() {
  return db.partner.findMany({ orderBy: { dateJoined: "desc" } });
}

export async function getPartnerDetail(partnerId: string) {
  const partner = await db.partner.findUnique({
    where: { id: partnerId },
    include: {
      leads: {
        orderBy: { createdAt: "desc" },
        include: { salesRep: { select: { name: true } } },
      },
    },
  });
  if (!partner) throw new ApiError(404, "Partner not found");
  return partner;
}

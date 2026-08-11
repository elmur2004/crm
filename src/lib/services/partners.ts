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
import { hashPassword } from "@/lib/auth/hash";

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

export const updateProspectSchema = createProspectSchema.partial();

/* V2 §6 — unbounded alternative numbers; JSON-array helpers. */
export function parseNumbers(json: string): string[] {
  try {
    const arr = JSON.parse(json) as unknown;
    return Array.isArray(arr) ? arr.filter((n): n is string => typeof n === "string") : [];
  } catch {
    return [];
  }
}

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
  /* Probe each recording against storage — a wiped file renders as a
     "missing" note instead of a dead player (same pattern as statements). */
  const { storage } = await import("@/lib/storage");
  const recordings = await Promise.all(
    prospect.recordings.map(async (r) => ({
      ...r,
      fileOk: (await storage.size(r.storageKey).catch(() => null)) !== null,
    })),
  );
  return { prospect: { ...prospect, recordings }, history };
}

export async function updateProspect(
  prospectId: string,
  input: z.infer<typeof updateProspectSchema>,
  actor: Actor,
) {
  const prospect = await getProspect(prospectId);
  return db.$transaction(async (tx) => {
    await tx.partnerProspect.update({
      where: { id: prospect.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.companyName !== undefined && { companyName: input.companyName }),
        ...(input.role !== undefined && { role: input.role ?? null }),
        ...(input.email !== undefined && { email: input.email ?? null }),
        ...(input.number !== undefined && { number: input.number }),
        ...(input.businessActivity !== undefined && { businessActivity: input.businessActivity }),
        ...(input.description !== undefined && { description: input.description ?? null }),
      },
    });
    await writeLog(tx, {
      entityType: "partner_prospect",
      entityId: prospect.id,
      actor,
      action: "update",
      trigger: "edit",
    });
    return tx.partnerProspect.findUniqueOrThrow({ where: { id: prospect.id } });
  });
}

/**
 * V2 §6 — adding alternative number(s), any count, any time. If the card sits in
 * Didn't Answer, the addition AUTO-RETURNS it to Lead (PP-2, "Returned to Lead —
 * new number added"); the numbers land in `alternativeNumbers` (the failed number
 * was recorded into `nonAnsweringNumbers` at the Didn't-Answer move).
 */
export async function addAlternativeNumbers(
  prospectId: string,
  numbers: string[],
  actor: Actor,
  role: Role,
) {
  const clean = numbers.map((n) => n.trim()).filter(Boolean);
  if (clean.length === 0) throw new ApiError(400, "Enter at least one number");
  const prospect = await getProspect(prospectId);

  return db.$transaction(async (tx) => {
    const fresh = await tx.partnerProspect.findUniqueOrThrow({
      where: { id: prospect.id },
      select: { stage: true, alternativeNumbers: true },
    });
    if (fresh.stage !== prospect.stage) {
      throw new ApiError(409, "This card just moved — reload and try again");
    }
    const existing = parseNumbers(fresh.alternativeNumbers);
    const merged = [...existing, ...clean.filter((n) => !existing.includes(n))];
    await tx.partnerProspect.update({
      where: { id: prospect.id },
      data: { alternativeNumbers: JSON.stringify(merged) },
    });

    if (prospect.stage === "didnt_answer") {
      const result = transition(
        partnersConfig,
        { stage: prospect.stage },
        { type: "number_added", slot: 2 },
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
        trigger: "numbers_added",
      });
    }
    return tx.partnerProspect.findUniqueOrThrow({ where: { id: prospect.id } });
  });
}

export const prospectEventSchema = z.object({
  event: z.discriminatedUnion("type", [
    z.object({ type: z.literal("next_action"), action: z.string() }),
    z.object({ type: z.literal("drag"), to: z.string() }), // founder V4 board
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
     service layer so it can never be bypassed. V2 §6: the numbers group (PP-1)
     now CARRIES the dialed-number selection. */
  if (result.requiredGroup) {
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

    /* V2 §6: moving to Didn't Answer records WHICH number(s) went unanswered. */
    if (result.requiredGroup?.group === "numbers" && opts.group?.group === "numbers") {
      const current = await tx.partnerProspect.findUniqueOrThrow({
        where: { id: prospect.id },
        select: { nonAnsweringNumbers: true },
      });
      const existing = parseNumbers(current.nonAnsweringNumbers);
      const merged = [
        ...existing,
        ...opts.group.data.dialedNumbers.filter((n) => !existing.includes(n)),
      ];
      await tx.partnerProspect.update({
        where: { id: prospect.id },
        data: { nonAnsweringNumbers: JSON.stringify(merged) },
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

        /* Partner ACCOUNT auto-created from the gate's credentials (founder
           directive — the admin fills email + password; supersedes the V2 §8
           auto password). No email → partner converts without a login (admin
           adds one in Users later). */
        let partnerUserId: string | null = null;
        if (gate.email) {
          const existingUser = await tx.user.findUnique({ where: { email: gate.email } });
          if (!existingUser) {
            const user = await tx.user.create({
              data: {
                name: gate.companyName,
                email: gate.email,
                passwordHash: await hashPassword(gate.password!), // schema: email ⇒ password
                passwordPlain: gate.password!,
              },
            });
            await tx.userRole.create({ data: { userId: user.id, role: "bsystems_partner" } });
            partnerUserId = user.id;
            await writeLog(tx, {
              entityType: "user",
              entityId: user.id,
              actor: opts.actor,
              action: "create",
              trigger: "partner_account",
            });
          } else {
            partnerUserId = existingUser.id;
          }
        }

        const partner = await tx.partner.create({
          data: {
            prospectId: prospect.id,
            userId: partnerUserId,
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

/* ---------- founder V4: admin edit + delete for prospects and partners ---------- */

/** Deletes a pipeline card and everything it owns: stage records, recordings
    (files too), and — when converted — the directory Partner (its attributed
    leads keep living, their attribution is cleared). */
export async function deleteProspect(prospectId: string, actor: Actor) {
  const prospect = await db.partnerProspect.findUnique({
    where: { id: prospectId },
    include: { recordings: true, partner: true },
  });
  if (!prospect) throw new ApiError(404, "Partner prospect not found");
  const fileKeys = prospect.recordings.map((r) => r.storageKey);
  await db.$transaction(async (tx) => {
    if (prospect.partner) {
      await tx.lead.updateMany({
        where: { partnerId: prospect.partner.id },
        data: { partnerId: null },
      });
      await tx.partner.delete({ where: { id: prospect.partner.id } });
    }
    await tx.attachment.deleteMany({ where: { partnerProspectId: prospectId } });
    await tx.followUp.deleteMany({ where: { partnerProspectId: prospectId } });
    await tx.meeting.deleteMany({ where: { partnerProspectId: prospectId } });
    await tx.lostInfo.deleteMany({ where: { partnerProspectId: prospectId } });
    await tx.partnerProspect.delete({ where: { id: prospectId } });
    await writeLog(tx, {
      entityType: "partner_prospect",
      entityId: prospectId,
      actor,
      action: "update",
      trigger: "deleted",
    });
  });
  const { storage } = await import("@/lib/storage");
  for (const key of fileKeys) await storage.delete(key);
}

export const updatePartnerSchema = z.object({
  companyName: z.string().min(1).max(200).optional(),
  keyPersonName: z.string().min(1).max(200).optional(),
  keyPersonRole: z.string().min(1).max(200).optional(),
  address: z.string().min(1).max(400).optional(),
  number: z.string().min(1).max(50).optional(),
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  businessActivity: z.string().min(1).max(300).optional(),
  importance: z.enum(["high", "medium", "low"]).optional(),
});

export async function updatePartner(
  partnerId: string,
  input: z.infer<typeof updatePartnerSchema>,
  actor: Actor,
) {
  const partner = await db.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw new ApiError(404, "Partner not found");
  return db.$transaction(async (tx) => {
    const updated = await tx.partner.update({
      where: { id: partnerId },
      data: {
        ...(input.companyName !== undefined && { companyName: input.companyName }),
        ...(input.keyPersonName !== undefined && { keyPersonName: input.keyPersonName }),
        ...(input.keyPersonRole !== undefined && { keyPersonRole: input.keyPersonRole }),
        ...(input.address !== undefined && { address: input.address }),
        ...(input.number !== undefined && { number: input.number }),
        ...(input.email !== undefined && { email: input.email ?? null }),
        ...(input.businessActivity !== undefined && { businessActivity: input.businessActivity }),
        ...(input.importance !== undefined && { importance: input.importance }),
      },
    });
    await writeLog(tx, {
      entityType: "partner",
      entityId: partnerId,
      actor,
      action: "update",
      trigger: "edit",
    });
    return updated;
  });
}

/** Removes the directory Partner. Attributed leads survive (attribution
    cleared); the linked login account survives (remove it from Users). */
export async function deletePartner(partnerId: string, actor: Actor) {
  const partner = await db.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw new ApiError(404, "Partner not found");
  await db.$transaction(async (tx) => {
    await tx.lead.updateMany({ where: { partnerId }, data: { partnerId: null } });
    await tx.partner.delete({ where: { id: partnerId } });
    await writeLog(tx, {
      entityType: "partner",
      entityId: partnerId,
      actor,
      action: "update",
      trigger: "deleted",
    });
  });
}

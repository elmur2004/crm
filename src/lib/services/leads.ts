import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "../../../generated/prisma/client";
import { internalCrmConfig } from "@/lib/pipeline-engine/configs/internal-crm";
import { bsystemsCrmConfig } from "@/lib/pipeline-engine/configs/bsystems-crm";
import { transition } from "@/lib/pipeline-engine/transition";
import type { EngineEvent, PipelineConfig } from "@/lib/pipeline-engine/types";
import {
  LEAD_TYPES,
  isSameStageAction,
  type Brand,
  type FollowUpContext,
  type OwnerType,
  type Role,
  type SameStageAction,
} from "@/lib/pipeline-engine/constants";
import { ApiError } from "@/lib/api-error";
import { storage } from "@/lib/storage";
import { cairoToUtc } from "@/lib/datetime";
import {
  followUpDueAt,
  followUpDueTimeSet,
  groupPayloadSchema,
  type GroupPayload,
  type WonDealInput,
} from "./groups";
import { writeLog, type Actor } from "./activity";
import { notifyAdmins, notifyUser } from "./notifications";
import {
  invalidateUndo,
  recordUndo,
  type CreatedRef,
  type StageEventSnapshot,
  type UpdatedRef,
} from "./undo";
import { formatMsg } from "@/lib/i18n/core";
import { stageLabel } from "@/lib/i18n/dict/labels";
import { undoLabels } from "@/lib/i18n/dict/undo";

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
        /* ADR-051 — who TYPED it in, on EVERY create path, not just the
           data-entry role's: it is useful audit data whoever entered it, and
           it is never the same question as who OWNS the lead. */
        createdByUserId: actor.id,
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
    /* ADR-045: undoing a fresh lead deletes it — refused later if it has since
       grown any history (the guard lives in performUndo). */
    const undoLabel = formatMsg(undoLabels.added, { name: lead.name });
    await recordUndo({
      tx,
      actor,
      kind: "lead_create",
      entityType: "lead",
      entityId: lead.id,
      fingerprint: lead.updatedAt,
      label: undoLabel.en,
      labelAr: undoLabel.ar,
      payload: {},
    });
    return lead;
  });
}

/* ADR-043 hardening: an archived lead is READ-ONLY except the chat and
   archive/unarchive itself — no stage events, no flags, no edits. Without
   this, a won-move on an archived lead would mint client/won-deal/dashboard
   records sourced from an invisible lead. */
function assertNotArchived(lead: { archived: boolean }) {
  if (lead.archived) throw new ApiError(400, "Unarchive this lead first");
}

/* V2 §3 — the always-available "Mark ready to close" flag: card marker + admin
   notification; not a stage transition. */
export async function markReadyToClose(brand: Brand, leadId: string, actor: Actor) {
  const lead = await getLead(brand, leadId);
  assertNotArchived(lead);
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
    const undoLabel = formatMsg(undoLabels.markedReady, { name: lead.name });
    await recordUndo({
      tx,
      actor,
      kind: "lead_ready",
      entityType: "lead",
      entityId: lead.id,
      fingerprint: fresh.updatedAt,
      label: undoLabel.en,
      labelAr: undoLabel.ar,
      payload: { readyToClose: false },
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

/* Founder directive (ADR-039) — the "didn't answer" flag: a card marker only
   ("just so we know"), toggleable; deliberately NOT a stage (the partnership
   pipeline's didnt_answer STAGE is a different flow). No stage change, no
   notification; both moves are activity-logged. */
export async function setNoAnswer(brand: Brand, leadId: string, value: boolean, actor: Actor) {
  const lead = await getLead(brand, leadId);
  assertNotArchived(lead);
  if (lead.noAnswer === value) return lead;
  return db.$transaction(async (tx) => {
    const fresh = await tx.lead.update({
      where: { id: lead.id },
      data: { noAnswer: value },
    });
    await writeLog(tx, {
      entityType: "lead",
      entityId: lead.id,
      actor,
      action: "update",
      trigger: value ? "no_answer" : "no_answer_cleared",
    });
    const undoLabel = formatMsg(
      value ? undoLabels.flaggedNoAnswer : undoLabels.clearedNoAnswer,
      { name: lead.name },
    );
    await recordUndo({
      tx,
      actor,
      kind: "lead_no_answer",
      entityType: "lead",
      entityId: lead.id,
      fingerprint: fresh.updatedAt,
      label: undoLabel.en,
      labelAr: undoLabel.ar,
      payload: { noAnswer: !value },
    });
    return fresh;
  });
}

/* Founder (ADR-043) — archive: a soft-hide flag, no data loss, restorable.
   Archived leads leave the boards, the default lists, the dashboards, and the
   To-Do projection; the Archived view on the Leads pages is the way back. */
export async function setArchived(brand: Brand, leadId: string, value: boolean, actor: Actor) {
  const lead = await getLead(brand, leadId);
  if (lead.archived === value) return lead;
  return db.$transaction(async (tx) => {
    const fresh = await tx.lead.update({
      where: { id: lead.id },
      data: { archived: value, archivedAt: value ? new Date() : null },
    });
    await writeLog(tx, {
      entityType: "lead",
      entityId: lead.id,
      actor,
      action: "update",
      trigger: value ? "archived" : "unarchived",
    });
    const undoLabel = formatMsg(value ? undoLabels.archived : undoLabels.unarchived, {
      name: lead.name,
    });
    await recordUndo({
      tx,
      actor,
      kind: "lead_archive",
      entityType: "lead",
      entityId: lead.id,
      fingerprint: fresh.updatedAt,
      label: undoLabel.en,
      labelAr: undoLabel.ar,
      payload: {
        archived: lead.archived,
        archivedAt: lead.archivedAt ? lead.archivedAt.toISOString() : null,
      },
    });
    return fresh;
  });
}

/* ============================================================================
   Founder — assign a lead to an agent or a partner: "inside the lead I have a
   button or an option to assign it to one of my partners or one of my agents
   who will be responsible for that lead, and it will be visible in his system
   and counted as his lead, and he is the owner."

   OWNERSHIP is Lead.ownerUserId + Lead.ownerType. It is what every "whose lead
   is this" surface reads: listOwnLeads scopes the agent/partner board by
   ownerUserId, requireLeadAccess gates by it, the owner buckets, the To-Do
   scope, Won Leads and the commission/closer surfaces all key off it.

   Lead.partnerId is DELIBERATELY NOT TOUCHED HERE. It is the PP-5 referral
   ATTRIBUTION — which partner company introduced this lead — and SPEC §5.5
   makes it permanent. Handing the lead to someone else to work does not rewrite
   who brought it in; conflating the two would silently move commissions.
   ========================================================================== */

/** The owner bucket implied by the target account's role (V2 §1). */
export function ownerTypeForRole(roles: readonly string[]): OwnerType | null {
  if (roles.includes("bsystems_agent")) return "agent";
  if (roles.includes("bsystems_partner")) return "partner";
  if (roles.includes("bsystems_sales")) return "internal";
  return null;
}

/** Admin-only (the route enforces requireBsAdmin) — B-Systems leads only. */
export async function assignLeadOwner(leadId: string, targetUserId: string, actor: Actor) {
  const lead = await getLead("bsystems", leadId);
  assertNotArchived(lead); // ADR-043 hardening — unarchive before reassigning

  const target = await db.user.findUnique({
    where: { id: targetUserId },
    include: { roles: true },
  });
  if (!target) throw new ApiError(404, "User not found");
  if (!target.active) throw new ApiError(400, "That account is deactivated");
  if (target.registrationStatus !== "approved") {
    throw new ApiError(400, "That registration is still awaiting approval");
  }
  /* Founder (To-Do) — "I can assign these to do as an admin or just take it
     myself": an ADMIN is a legal target too. The lead lands in the admin
     bucket with that admin as owner — exactly the state an admin-CREATED lead
     already has (bucketFor). The rule lives here, not in ownerTypeForRole, so
     the assignable ROSTER keeps excluding admins everywhere else.
     Review: admin wins FIRST, mirroring the app's one role precedence
     (bsRoleOf → bucketFor). An account that holds bsystems_admin AND a second
     B-Systems role is still an admin everywhere else, so taking a lead must
     not park it in the shared internal bucket — where it would surface on
     every internal-sales board and To-Do. */
  const targetRoles = target.roles.map((r) => r.role);
  const ownerType = targetRoles.includes("bsystems_admin")
    ? ("admin" as const)
    : ownerTypeForRole(targetRoles);
  if (!ownerType) {
    throw new ApiError(400, "Assign a lead to an agent, a partner or an internal sales account");
  }
  if (lead.ownerUserId === target.id && lead.ownerType === ownerType) return lead;

  const updated = await db.$transaction(async (tx) => {
    const fresh = await tx.lead.update({
      where: { id: lead.id },
      data: { ownerUserId: target.id, ownerType },
    });
    await writeLog(tx, {
      entityType: "lead",
      entityId: lead.id,
      actor,
      action: "update",
      trigger: "assigned",
    });
    /* founder: "visible in his system" — their own bell, deep-linked. Taking
       a lead YOURSELF (the To-Do's "take it" self-assign) must not ping
       yourself — the activity log and the undo entry still record the move. */
    if (target.id !== actor.id) {
      await notifyUser(tx, {
        userId: target.id,
        type: "assigned",
        title: `Assigned to you: ${lead.name}`,
        body: `${actor.label} made you the owner of "${lead.name}"${
          lead.companyName ? ` (${lead.companyName})` : ""
        }.`,
        leadId: lead.id,
      });
    }
    const undoLabel = formatMsg(undoLabels.assigned, { name: lead.name, owner: target.name });
    await recordUndo({
      tx,
      actor,
      kind: "lead_assign",
      entityType: "lead",
      entityId: lead.id,
      fingerprint: fresh.updatedAt,
      label: undoLabel.en,
      labelAr: undoLabel.ar,
      /* the inverse: exactly the two ownership columns, nothing else */
      payload: { ownerUserId: lead.ownerUserId, ownerType: lead.ownerType },
    });
    return fresh;
  });
  return updated;
}

/* V2 §11 + founder V4 — admin delete (hard delete; children cascade). A WON
   lead cascades its whole financial trail: statements (+proof files),
   milestones, the won deal, then the lead. */
export async function deleteLead(brand: Brand, leadId: string, actor: Actor) {
  const lead = await getLead(brand, leadId);
  const wonDeal = await db.wonDeal.findUnique({
    where: { leadId: lead.id },
    include: { milestones: { include: { statement: { include: { proofs: true } } } }, attachments: true },
  });
  const orphanedFileKeys: string[] = [];
  await db.$transaction(async (tx) => {
    if (wonDeal) {
      for (const m of wonDeal.milestones) {
        if (m.statement) {
          for (const proof of m.statement.proofs) {
            orphanedFileKeys.push(proof.storageKey);
            await tx.attachment.delete({ where: { id: proof.id } });
          }
          await tx.statement.delete({ where: { id: m.statement.id } });
        }
      }
      await tx.milestone.deleteMany({ where: { wonDealId: wonDeal.id } });
      for (const a of wonDeal.attachments) {
        orphanedFileKeys.push(a.storageKey);
        await tx.attachment.delete({ where: { id: a.id } });
      }
      await tx.wonDeal.delete({ where: { id: wonDeal.id } });
    }
    await tx.lead.delete({ where: { id: lead.id } });
    await writeLog(tx, {
      entityType: "lead",
      entityId: lead.id,
      actor,
      action: "update",
      trigger: "deleted",
    });
    /* ADR-045: deletion is NOT undoable (the data is gone) — and it must not
       leave an older entry behind for the button to offer instead. */
    await invalidateUndo(tx, actor);
  });
  for (const key of orphanedFileKeys) {
    await storage.delete(key); // best-effort after commit
  }
}

export async function updateLead(
  brand: Brand,
  leadId: string,
  input: z.infer<typeof updateLeadSchema>,
  actor: Actor,
) {
  const lead = await getLead(brand, leadId);
  assertNotArchived(lead); // ADR-043 hardening — edits need an unarchive first
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
        // V2 fields — were silently dropped before (founder V4 fix)
        ...(input.position !== undefined && { position: input.position ?? null }),
        ...(input.companyName !== undefined && { companyName: input.companyName ?? null }),
        ...(input.industry !== undefined && { industry: input.industry ?? null }),
        ...(input.requirements !== undefined && { requirements: input.requirements ?? null }),
      },
    });
    await writeLog(tx, {
      entityType: "lead",
      entityId: lead.id,
      actor,
      action: "update",
      trigger: "edit",
    });
    /* ADR-045: the inverse of an edit is the PRIOR value of exactly the fields
       this call touched — nothing else is put back. */
    const before: Record<string, string | null> = {};
    for (const field of EDITABLE_FIELDS) {
      if (input[field] !== undefined) before[field] = lead[field] ?? null;
    }
    const undoLabel = formatMsg(undoLabels.edited, { name: lead.name });
    await recordUndo({
      tx,
      actor,
      kind: "lead_update",
      entityType: "lead",
      entityId: lead.id,
      fingerprint: updated.updatedAt,
      label: undoLabel.en,
      labelAr: undoLabel.ar,
      payload: { fields: before },
    });
    return updated;
  });
}

/* The lead columns updateLead may write — the undo snapshot mirrors exactly
   these (salesRepId included: reassignment is an edit like any other). */
const EDITABLE_FIELDS = [
  "name",
  "number",
  "email",
  "type",
  "description",
  "salesRepId",
  "position",
  "companyName",
  "industry",
  "requirements",
] as const;

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
      /* founder (assignment): the detail names the PERSON who owns the lead,
         not just the bucket — that is what "he is the owner" means */
      owner: { select: { id: true, name: true } },
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

/* Founder same-stage records: the undo pill must describe what really happened
   — a record was added, nothing was moved. */
const SAME_STAGE_UNDO_LABELS: Record<SameStageAction, (typeof undoLabels)["movedTo"]> = {
  follow_up_again: undoLabels.followedUpAgain,
  negotiation_follow_up: undoLabels.responseDate,
  reschedule_meeting: undoLabels.rescheduledMeeting,
};

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
  assertNotArchived(lead); // ADR-043 hardening — no stage events on archived leads
  const config = configForBrand(opts.brand);

  /* Founder: "another follow-up" / "the response date" / "reschedule" — actions
     that add the stage's own record and leave the card where it is. */
  const sameStageAction: SameStageAction | null =
    opts.event.type === "next_action" && isSameStageAction(opts.event.action)
      ? opts.event.action
      : null;

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
      select: { stage: true, noAnswer: true },
    });
    if (fresh.stage !== lead.stage) {
      throw new ApiError(409, "This lead just moved — reload and try again");
    }

    /* ADR-045: everything this event writes is collected as it happens, so the
       undo entry can put the lead back EXACTLY as it was. */
    const created: CreatedRef[] = [];
    const updated: UpdatedRef[] = [];

    /* Event-specific pre-writes on existing records (§5.3 triggers). */
    if (opts.event.type === "proposal_sent") {
      const unsent = await tx.proposal.findFirst({
        where: { leadId: lead.id, sent: false },
        orderBy: { createdAt: "desc" },
      });
      if (!unsent) throw new ApiError(400, "No unsent proposal on this lead");
      updated.push({
        model: "proposal",
        id: unsent.id,
        sent: unsent.sent,
        sentAt: unsent.sentAt ? unsent.sentAt.toISOString() : null,
      });
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
      updated.push({
        model: "meeting",
        id: meeting.id,
        datetime: meeting.datetime ? meeting.datetime.toISOString() : null,
        outcome: meeting.outcome,
        outcomeDestination: meeting.outcomeDestination,
      });
      await tx.meeting.update({
        where: { id: meeting.id },
        data: {
          outcome: opts.event.outcome,
          outcomeDestination: opts.event.destination ?? null,
        },
      });
    }

    const writes = await persistGroup(
      tx,
      { leadId: lead.id },
      result.requiredGroup?.group ?? null,
      opts.group,
      {
        followUpContext:
          result.requiredGroup?.group === "follow_up" ? result.requiredGroup.context : undefined,
      },
    );
    created.push(...writes.created);
    updated.push(...writes.updated);

    if (result.toStage !== lead.stage) {
      /* Founder (ADR-039 addendum): ANY stage move signals the client was
         reached — the "didn't answer" marker clears itself with the move.
         The cleared row is logged only when the flag was actually set. */
      await tx.lead.update({
        where: { id: lead.id },
        data: { stage: result.toStage, ...(fresh.noAnswer ? { noAnswer: false } : {}) },
      });
      if (fresh.noAnswer) {
        await writeLog(tx, {
          entityType: "lead",
          entityId: lead.id,
          actor: opts.actor,
          action: "update",
          trigger: "no_answer_cleared",
        });
      }
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

    /* Founder same-stage records: the card did not move, so the history reads
       "group added" with no from → to arrow. Every OTHER same-stage case (T-7's
       delayed meeting, re-selecting the current stage) keeps its existing
       stage_change wording byte-for-byte. */
    await writeLog(tx, {
      entityType: "lead",
      entityId: lead.id,
      actor: opts.actor,
      action: sameStageAction ? "group_added" : result.auto ? "auto_transfer" : "stage_change",
      fromStage: sameStageAction ? null : result.fromStage,
      toStage: sameStageAction ? null : result.toStage,
      trigger: result.logTrigger,
    });

    /* ADR-045 — the financial line: a move that mints a won deal or a client is
       NEVER undoable. Undoing it would have to unwind milestones, statements
       and commissions, so instead it RETIRES this user's pending entries: the
       button goes quiet rather than offering to revert an older action. */
    const financial = result.sideEffects.some(
      (e) => e === "create_won_deal" || e === "create_client",
    );
    if (financial) {
      await invalidateUndo(tx, opts.actor);
    } else {
      const after = await tx.lead.findUniqueOrThrow({
        where: { id: lead.id },
        select: { updatedAt: true },
      });
      const snapshot: StageEventSnapshot = {
        stage: lead.stage,
        noAnswer: fresh.noAnswer,
        created,
        updated,
      };
      const undoLabel = sameStageAction
        ? formatMsg(SAME_STAGE_UNDO_LABELS[sameStageAction], { name: lead.name })
        : formatMsg(undoLabels.movedTo, {
            name: lead.name,
            stage: {
              en: stageLabel("en", result.toStage),
              ar: stageLabel("ar", result.toStage),
            },
          });
      await recordUndo({
        tx,
        actor: opts.actor,
        kind: "lead_event",
        entityType: "lead",
        entityId: lead.id,
        fingerprint: after.updatedAt,
        label: undoLabel.en,
        labelAr: undoLabel.ar,
        payload: snapshot as unknown as Prisma.InputJsonValue,
      });
    }
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
/* Returns what it wrote, so ADR-045 can store the exact inverse: the ids to
   delete on undo, and the prior values of anything it mutated in place. */
export interface GroupWrites {
  created: CreatedRef[];
  updated: UpdatedRef[];
}

export async function persistGroup(
  tx: Prisma.TransactionClient,
  parent: { leadId?: string; partnerProspectId?: string; portalDealId?: string },
  group: string | null,
  payload: GroupPayload | undefined,
  extra: { followUpContext?: FollowUpContext },
): Promise<GroupWrites> {
  const writes: GroupWrites = { created: [], updated: [] };
  if (!group || !payload) return writes;
  if (payload.group === "follow_up" && group === "follow_up") {
    const row = await tx.followUp.create({
      data: {
        ...parent,
        context: extra.followUpContext ?? "initial",
        dueAt: followUpDueAt(payload.data),
        /* ADR-063 — true only when the submitter actually chose the slot; the
           09:00 Cairo default stays indistinguishable in `dueAt` alone. */
        dueTimeSet: followUpDueTimeSet(payload.data),
        method: payload.data.method,
        ownerSalesRepId: payload.data.ownerSalesRepId ?? null,
        ownerPortalRepId: payload.data.ownerPortalRepId ?? null,
        followingUpWith: payload.data.followingUpWith ?? null,
      },
    });
    writes.created.push({ model: "followUp", id: row.id });
  } else if (payload.group === "meeting" && group === "meeting") {
    const row = await tx.meeting.create({
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
    writes.created.push({ model: "meeting", id: row.id });
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
    writes.updated.push({
      model: "meeting",
      id: meeting.id,
      datetime: meeting.datetime ? meeting.datetime.toISOString() : null,
      outcome: meeting.outcome,
      outcomeDestination: meeting.outcomeDestination,
    });
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
    const row = await tx.proposal.create({
      data: {
        ...parent,
        service: payload.data.service,
        estimatedValue: payload.data.estimatedValue ?? null,
        sent: false,
      },
    });
    writes.created.push({ model: "proposal", id: row.id });
  } else if (payload.group === "lost" && group === "lost") {
    const row = await tx.lostInfo.create({ data: { ...parent, reason: payload.data.reason } });
    writes.created.push({ model: "lostInfo", id: row.id });
  } else if (payload.group === "won" && group === "won") {
    if (!parent.leadId) throw new ApiError(400, "Won group applies to leads");
    const row = await tx.wonInfo.create({
      data: {
        leadId: parent.leadId,
        estimatedValue: payload.data.estimatedValue,
        technicalOwner: payload.data.technicalOwner,
        collectedAmount: payload.data.collectedAmount,
      },
    });
    writes.created.push({ model: "wonInfo", id: row.id });
  } else if (group === "numbers") {
    // PP-1 (V2 §6): the dialed-number selection is consumed by the partners service
  } else if (group === "won_partner" && payload.group === "won_partner") {
    // PP-4: the gate data is consumed by the create_partner side effect, not a child record
  } else if (group === "won_deal" && payload.group === "won_deal") {
    // V2 §4: the milestone tab is consumed by the create_won_deal side effect
  } else if (group === "negotiation" && payload.group === "negotiation") {
    if (!parent.leadId) throw new ApiError(400, "Negotiation notes apply to leads");
    const row = await tx.negotiationNote.create({
      data: { leadId: parent.leadId, note: payload.data.note },
    });
    writes.created.push({ model: "negotiationNote", id: row.id });
  } else {
    throw new ApiError(400, `Group payload "${payload.group}" does not match required "${group}"`);
  }
  return writes;
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

import { z } from "zod";
import { db } from "@/lib/db";
import {
  PROSPECT_KINDS,
  partnersConfig,
  partnersConfigFor,
} from "@/lib/pipeline-engine/configs/partners";
import { transition } from "@/lib/pipeline-engine/transition";
import type { EngineEvent } from "@/lib/pipeline-engine/types";
import { isSameStageAction, type Role, type SameStageAction } from "@/lib/pipeline-engine/constants";
import { ApiError } from "@/lib/api-error";
import {
  groupPayloadSchema,
  type GroupPayload,
  type WonAgentInput,
  type WonPartnerInput,
} from "./groups";
import { persistGroup } from "./leads";
import { writeLog, type Actor } from "./activity";
import {
  invalidateUndo,
  recordUndo,
  type CreatedRef,
  type StageEventSnapshot,
  type UpdatedRef,
} from "./undo";
import { storage, validateAndStore } from "@/lib/storage";
import { hashPassword } from "@/lib/auth/hash";
import { isValidPhone, normalizePhone } from "@/lib/auth/phone";
import type { Prisma } from "../../../generated/prisma/client";
import { formatMsg } from "@/lib/i18n/core";
import { stageLabel } from "@/lib/i18n/dict/labels";
import { undoLabels } from "@/lib/i18n/dict/undo";

/* App B Partners & Agents pipeline (§7.2–§7.3, §10.2). applyProspectEvent mirrors
   applyLeadEvent on the partners config; updateProspect fires PP-2's auto-return
   when a new number lands on a Didn't-Answer card; the PP-4 completeness gate is
   the won_partner Zod schema and conversion creates the directory Partner.

   Founder: one board, TWO kinds of card. A `partner` card is exactly what it has
   always been. An `agent` card collects the PUBLIC SIGNUP form's fields (first +
   last name, phone, email, address, speciality, CV) minus the password, and its
   Won gate mints the account the admin promises ("I will create for them a user
   and a password"). Requiredness is therefore CONDITIONAL on the kind — enforced
   here in Zod, not in the database, so both kinds live in one table. */

const prospectFields = z.object({
  name: z.string().min(1).max(200),
  companyName: z.string().max(200).optional(),
  role: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  number: z.string().min(1).max(50),
  businessActivity: z.string().max(300).optional(),
  address: z.string().max(400).optional(),
  speciality: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
});

type ProspectFields = Partial<z.infer<typeof prospectFields>>;

const required = (value: string | undefined | null) => Boolean(value && value.trim());

/** The kind-conditional rules, shared by create (Zod) and edit (service).

    Founder: "the CV should be optional. Everything is optional other than the
    name and the number... just to not confuse this one." An agent card is
    typically opened mid-phone-call with nothing else in hand, so it asks the
    SIGNUP FORM'S FIELDS but demands only name + number — and the requirements
    move to the Won gate (wonAgentSchema), which is exactly what this pipeline's
    gates are for. A PARTNER card is deliberately NOT relaxed: "and the partners
    as it is" — companyName + businessActivity stay required. The asymmetry is
    intentional; do not "fix" it. */
function kindIssues(kind: string, data: ProspectFields): Array<{ path: string; message: string }> {
  const issues: Array<{ path: string; message: string }> = [];
  if (kind === "agent") {
    /* the number is one of the two mandatory fields, so it is held to the
       signup form's rule (portal-reps.signupSchema) */
    if (data.number !== undefined && !isValidPhone(data.number)) {
      issues.push({ path: "number", message: "Enter a valid phone number" });
    }
  } else {
    if (!required(data.companyName)) {
      issues.push({ path: "companyName", message: "Company name is required" });
    }
    if (!required(data.businessActivity)) {
      issues.push({ path: "businessActivity", message: "Business activity is required" });
    }
  }
  return issues;
}

export const createProspectSchema = prospectFields
  .extend({ kind: z.enum(PROSPECT_KINDS).default("partner") })
  .superRefine((data, ctx) => {
    for (const issue of kindIssues(data.kind, data)) {
      ctx.addIssue({ code: "custom", path: [issue.path], message: issue.message });
    }
  });

/* kind is deliberately absent: it is chosen at creation and FIXED afterwards —
   the Won gate (directory partner vs. agent account) depends on it. */
export const updateProspectSchema = prospectFields.partial();

/* V2 §6 — unbounded alternative numbers; JSON-array helpers. */
export function parseNumbers(json: string): string[] {
  try {
    const arr = JSON.parse(json) as unknown;
    return Array.isArray(arr) ? arr.filter((n): n is string => typeof n === "string") : [];
  } catch {
    return [];
  }
}

/** The card's headline: a partner company, or the agent's own name. */
export function prospectTitle(p: { kind: string; name: string; companyName: string | null }): string {
  return p.kind === "agent" ? p.name : (p.companyName ?? p.name);
}

export async function createProspect(
  input: z.infer<typeof createProspectSchema>,
  actor: Actor,
  opts?: { cv?: File },
) {
  const agent = input.kind === "agent";
  /* The CV is stored BEFORE the transaction (validation can reject) and deleted
     again if the write fails — the signup path's rule, so no file is orphaned. */
  const storedCv = agent && opts?.cv ? await validateAndStore("cv", opts.cv) : null;
  try {
    return await db.$transaction(async (tx) => {
      const prospect = await tx.partnerProspect.create({
        data: {
          kind: input.kind,
          name: input.name,
          /* only the fields the kind owns are written — the other set stays null */
          companyName: agent ? null : (input.companyName ?? null),
          role: agent ? null : (input.role ?? null),
          businessActivity: agent ? null : (input.businessActivity ?? null),
          address: agent ? (input.address ?? null) : null,
          speciality: agent ? (input.speciality ?? null) : null,
          email: input.email ?? null,
          number: input.number,
          description: input.description ?? null,
        },
      });
      if (storedCv) {
        await tx.attachment.create({
          data: {
            kind: "cv",
            partnerProspectId: prospect.id,
            filename: storedCv.filename,
            storageKey: storedCv.key,
            mime: storedCv.mime,
            size: storedCv.size,
          },
        });
      }
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
  } catch (err) {
    if (storedCv) await storage.delete(storedCv.key);
    throw err;
  }
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
      /* the card's attachments are recordings AND (agent cards) the CV — the
         player list must only ever see the recordings */
      recordings: { where: { kind: "recording" }, orderBy: { createdAt: "asc" } },
      partner: true,
      agentUser: { select: { id: true, name: true, email: true } },
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
  /* the agent card's CV (kind "cv" on the same parent) — shown on the card and
     re-parented onto the PortalRep at conversion */
  const cv = await db.attachment.findFirst({
    where: { partnerProspectId: prospectId, kind: "cv" },
  });
  return { prospect: { ...prospect, recordings, cv }, history };
}

export async function updateProspect(
  prospectId: string,
  input: z.infer<typeof updateProspectSchema>,
  actor: Actor,
) {
  const prospect = await getProspect(prospectId);
  const agent = prospect.kind === "agent";

  /* The kind is FIXED at creation (the Won gate depends on it), so an edit can
     never switch a card from one field set to the other — it only re-validates
     the SAME kind's rules against the merged record. */
  const merged = {
    name: input.name ?? prospect.name,
    companyName: input.companyName ?? prospect.companyName ?? undefined,
    role: input.role ?? prospect.role ?? undefined,
    email: input.email ?? prospect.email ?? undefined,
    number: input.number ?? prospect.number,
    businessActivity: input.businessActivity ?? prospect.businessActivity ?? undefined,
    address: input.address ?? prospect.address ?? undefined,
    speciality: input.speciality ?? prospect.speciality ?? undefined,
  };
  const issues = kindIssues(prospect.kind, merged);
  if (issues.length > 0) throw new ApiError(400, issues.map((i) => i.message).join("; "));

  return db.$transaction(async (tx) => {
    await tx.partnerProspect.update({
      where: { id: prospect.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.email !== undefined && { email: input.email ?? null }),
        ...(input.number !== undefined && { number: input.number }),
        ...(input.description !== undefined && { description: input.description ?? null }),
        /* the other kind's columns stay untouched, whatever the payload says */
        ...(!agent && input.companyName !== undefined && { companyName: input.companyName }),
        ...(!agent && input.role !== undefined && { role: input.role ?? null }),
        ...(!agent &&
          input.businessActivity !== undefined && { businessActivity: input.businessActivity }),
        ...(agent && input.address !== undefined && { address: input.address }),
        ...(agent && input.speciality !== undefined && { speciality: input.speciality }),
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

  /* Founder: same-stage records on the partnership cards too (another
     follow-up, a rescheduled meeting) — the card never leaves its column. */
  const sameStageAction: SameStageAction | null =
    opts.event.type === "next_action" && isSameStageAction(opts.event.action)
      ? opts.event.action
      : null;

  /* the shared config, with the Won gate this card's kind requires (PP-4/PP-4a) */
  const config = partnersConfigFor(prospect.kind);
  const result = transition(config, { stage: prospect.stage }, opts.event, {
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

    /* ADR-045: collect the inverse as the event writes it. */
    const created: CreatedRef[] = [];
    const updated: UpdatedRef[] = [];
    let numbersBefore: string | undefined;

    if (opts.event.type === "meeting_outcome") {
      const meeting = await tx.meeting.findFirst({
        where: { partnerProspectId: prospect.id },
        orderBy: { createdAt: "desc" },
      });
      if (!meeting) throw new ApiError(400, "No meeting recorded on this prospect");
      updated.push({
        model: "meeting",
        id: meeting.id,
        datetime: meeting.datetime ? meeting.datetime.toISOString() : null,
        outcome: meeting.outcome,
        outcomeDestination: meeting.outcomeDestination,
      });
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
      numbersBefore = current.nonAnsweringNumbers;
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

    const writes = await persistGroup(
      tx,
      { partnerProspectId: prospect.id },
      result.requiredGroup?.group ?? null,
      opts.group,
      {
        followUpContext:
          result.requiredGroup?.group === "follow_up" ? result.requiredGroup.context : undefined,
      },
    );
    created.push(...writes.created);
    updated.push(...writes.updated);

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

      if (effect === "create_agent") {
        /* PP-4a (founder): "once I put them Won, I have to create for them a user
           and a password — they will not apply, I will create for them a user and
           a password." So this mints the whole account the signup flow would have
           produced, minus the waiting: approved from birth, never a Registration.
           Same three writes as signupRep + the CV, in ONE transaction. */
        const gate = (opts.group as { group: "won_agent"; data: WonAgentInput }).data;
        const email = gate.email.trim().toLowerCase();
        const phone = normalizePhone(gate.phone);
        if (!isValidPhone(phone)) throw new ApiError(400, "Enter a valid phone number");
        if (await tx.user.findUnique({ where: { email } })) {
          throw new ApiError(409, "An account with this email already exists");
        }
        if (await tx.user.findUnique({ where: { phone } })) {
          throw new ApiError(409, "An account with this phone number already exists");
        }

        const name = `${gate.firstName} ${gate.lastName}`;
        const user = await tx.user.create({
          data: {
            name,
            email,
            phone,
            passwordHash: await hashPassword(gate.password),
            passwordPlain: gate.password, // admin-visibility copy (schema comment)
            active: true,
            /* the ADMIN created this account — it never sits in Registrations */
            registrationStatus: "approved",
          },
        });
        await tx.userRole.create({ data: { userId: user.id, role: "bsystems_agent" } });
        const rep = await tx.portalRep.create({
          data: {
            userId: user.id,
            firstName: gate.firstName,
            lastName: gate.lastName,
            address: gate.address,
            speciality: gate.speciality,
          },
        });
        /* the CV collected on the card becomes the agent's profile CV — moved,
           never copied, so the stored file is neither duplicated nor orphaned */
        const cv = await tx.attachment.findFirst({
          where: { partnerProspectId: prospect.id, kind: "cv" },
        });
        if (cv) {
          await tx.attachment.update({
            where: { id: cv.id },
            data: { portalRepId: rep.id, partnerProspectId: null },
          });
        }
        await tx.partnerProspect.update({
          where: { id: prospect.id },
          data: { converted: true, agentUserId: user.id },
        });
        await writeLog(tx, {
          entityType: "user",
          entityId: user.id,
          actor: opts.actor,
          action: "create",
          trigger: "agent_account",
        });
        await writeLog(tx, {
          entityType: "portal_rep",
          entityId: rep.id,
          actor: opts.actor,
          action: "create",
          trigger: "PP-4a",
        });
      }
    }

    await writeLog(tx, {
      entityType: "partner_prospect",
      entityId: prospect.id,
      actor: opts.actor,
      action: sameStageAction ? "group_added" : result.auto ? "auto_transfer" : "stage_change",
      fromStage: sameStageAction ? null : result.fromStage,
      toStage: sameStageAction ? null : result.toStage,
      trigger: result.logTrigger,
    });

    /* ADR-045 — PP-4/PP-4a conversion mints a Partner or a whole agent account:
       never undoable, and it retires this user's pending entries so the button
       does not offer an older action instead. */
    if (result.sideEffects.includes("create_partner") || result.sideEffects.includes("create_agent")) {
      await invalidateUndo(tx, opts.actor);
    } else {
      const after = await tx.partnerProspect.findUniqueOrThrow({
        where: { id: prospect.id },
        select: { updatedAt: true },
      });
      const snapshot: StageEventSnapshot = {
        stage: prospect.stage,
        noAnswer: false, // prospects carry no lead-style flag
        created,
        updated,
        ...(numbersBefore !== undefined ? { nonAnsweringNumbers: numbersBefore } : {}),
      };
      const name = prospectTitle(prospect);
      const undoLabel = sameStageAction
        ? formatMsg(
            sameStageAction === "reschedule_meeting"
              ? undoLabels.rescheduledMeeting
              : undoLabels.followedUpAgain,
            { name },
          )
        : formatMsg(undoLabels.movedTo, {
            name,
            stage: {
              en: stageLabel("en", result.toStage),
              ar: stageLabel("ar", result.toStage),
            },
          });
      await recordUndo({
        tx,
        actor: opts.actor,
        kind: "prospect_event",
        entityType: "partner_prospect",
        entityId: prospect.id,
        fingerprint: after.updatedAt,
        label: undoLabel.en,
        labelAr: undoLabel.ar,
        payload: snapshot as unknown as Prisma.InputJsonValue,
      });
    }
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

/** The agent card's CV — attached at creation or added later, replaced in place.
    At the Won gate it is re-parented onto the PortalRep, so the agent's profile
    carries exactly the document a self-applied agent's would. */
export async function setProspectCv(prospectId: string, file: File, actor: Actor) {
  const prospect = await getProspect(prospectId);
  if (prospect.kind !== "agent") throw new ApiError(400, "Only agent cards carry a CV");
  const stored = await validateAndStore("cv", file);
  const previous = await db.attachment.findFirst({
    where: { partnerProspectId: prospect.id, kind: "cv" },
  });
  try {
    const attachment = await db.$transaction(async (tx) => {
      if (previous) await tx.attachment.delete({ where: { id: previous.id } });
      const created = await tx.attachment.create({
        data: {
          kind: "cv",
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
        trigger: "cv_added",
      });
      return created;
    });
    if (previous) await storage.delete(previous.storageKey);
    return attachment;
  } catch (err) {
    await storage.delete(stored.key);
    throw err;
  }
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

import { db } from "@/lib/db";
import type { Prisma } from "../../../generated/prisma/client";
import { ApiError } from "@/lib/api-error";
import { writeLog, type Actor } from "./activity";
import { partnersConfigFor } from "@/lib/pipeline-engine/configs/partners";

/* ============================================================================
   UNDO (ADR-045) — founder: "an undo button that undoes the last action I did".

   The model is a SNAPSHOT-INVERSE with an explicit ALLOWLIST:
   every undoable mutation writes one UndoEntry INSIDE its own transaction,
   carrying the prior state (and the ids it created). Undo replays that
   snapshot; it never re-runs history and never touches anything financial.

   Guards, all enforced here (server-side):
     · ownership — only the author of the action may undo it;
     · recency   — only the LATEST unconsumed entry, and only within the window;
     · integrity — the entity's updatedAt is fingerprinted; changed since = refuse;
     · once      — the row is consumed atomically, so a double-click cannot apply
                   the same inverse twice;
     · honesty   — actions that are NOT undoable (a win, a delete) consume the
                   user's outstanding entries, so the button never quietly offers
                   to revert something older than the last thing that happened.
   ========================================================================== */

export const UNDO_WINDOW_MS = 10 * 60 * 1000; // founder-facing: "the last few minutes"

export type UndoKind =
  | "lead_event"
  | "lead_no_answer"
  | "lead_ready"
  | "lead_archive"
  | "lead_update"
  | "lead_create"
  | "lead_assign" // founder: hand a lead to an agent/partner — restores the prior owner
  | "prospect_event"
  | "vault_archive"; // ADR-053: archive/restore of a vault record — the SAFE vault mutations

/** A child row this action CREATED — undo deletes exactly these ids. */
export type CreatedRef =
  | { model: "followUp"; id: string }
  | { model: "meeting"; id: string }
  | { model: "proposal"; id: string }
  | { model: "lostInfo"; id: string }
  | { model: "wonInfo"; id: string }
  | { model: "negotiationNote"; id: string };

/** A row this action MUTATED — undo puts these exact fields back. Typed per
    shape (not a generic map) so JSON revival stays explicit and safe. */
export type UpdatedRef =
  | {
      model: "meeting";
      id: string;
      datetime: string | null;
      outcome: string | null;
      outcomeDestination: string | null;
    }
  | { model: "proposal"; id: string; sent: boolean; sentAt: string | null };

export interface StageEventSnapshot {
  stage: string;
  noAnswer: boolean;
  created: CreatedRef[];
  updated: UpdatedRef[];
  /** prospects only (PP-1): the dialed-numbers list before the move */
  nonAnsweringNumbers?: string;
}

interface LeadFieldsSnapshot {
  fields: Record<string, string | null>;
}

/* ---------------------------------------------------------------- recording */

/* ADR-053 — the vault's four archivable kinds join the undo surface. The
   delegate map keeps performUndo generic: every vault inverse is the same
   {archived, archivedAt} restore, whatever the table. */
export type UndoEntityType =
  | "lead"
  | "partner_prospect"
  | "vault_form"
  | "vault_sheet"
  | "vault_document"
  | "vault_task";

/** The minimum surface a vault-archive inverse needs (structural, so the four
    concrete delegates unify — the ArchivableDelegate pattern). */
type VaultArchiveDelegate = {
  findUnique(args: { where: { id: string } }): Promise<{ id: string; updatedAt: Date } | null>;
  update(args: {
    where: { id: string };
    data: { archived: boolean; archivedAt: Date | null };
  }): Promise<unknown>;
};

const VAULT_DELEGATES: Record<string, (tx: Prisma.TransactionClient) => VaultArchiveDelegate> = {
  vault_form: (tx) => tx.vaultForm,
  vault_sheet: (tx) => tx.vaultSheet,
  vault_document: (tx) => tx.vaultDocument,
  vault_task: (tx) => tx.vaultTask,
};

function isVaultEntityType(
  t: string,
): t is "vault_form" | "vault_sheet" | "vault_document" | "vault_task" {
  return t in VAULT_DELEGATES;
}

export interface RecordUndoInput {
  tx: Prisma.TransactionClient;
  actor: Actor;
  kind: UndoKind;
  entityType: UndoEntityType;
  entityId: string;
  /** the entity's updatedAt AFTER the mutation — the integrity fingerprint */
  fingerprint: Date;
  label: string;
  labelAr: string;
  payload: Prisma.InputJsonValue;
}

/** Write the inverse of what just happened. No actor id (seeds, system moves,
    impersonated writes without a user) = nothing to undo, by design. */
export async function recordUndo(input: RecordUndoInput): Promise<void> {
  if (!input.actor.id) return;
  await input.tx.undoEntry.create({
    data: {
      userId: input.actor.id,
      kind: input.kind,
      entityType: input.entityType,
      entityId: input.entityId,
      label: input.label,
      labelAr: input.labelAr,
      fingerprint: input.fingerprint.toISOString(),
      payload: input.payload,
    },
  });
}

/** An action outside the allowlist just happened: retire this user's pending
    entries so "Undo" never points at something older than their last action. */
export async function invalidateUndo(
  tx: Prisma.TransactionClient,
  actor: Actor,
): Promise<void> {
  if (!actor.id) return;
  await tx.undoEntry.updateMany({
    where: { userId: actor.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
}

/* ------------------------------------------------------------------ reading */

export interface PendingUndo {
  id: string;
  label: string;
  labelAr: string;
  createdAt: Date;
}

/** The one entry the header may offer: this user's latest unconsumed action,
    still inside the window. */
export async function pendingUndoFor(userId: string): Promise<PendingUndo | null> {
  const entry = await db.undoEntry.findFirst({
    where: { userId, consumedAt: null, createdAt: { gt: new Date(Date.now() - UNDO_WINDOW_MS) } },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, labelAr: true, createdAt: true },
  });
  return entry;
}

/* ----------------------------------------------------------------- applying */

const CHANGED_SINCE = "This changed since — undo is no longer safe";

/** Apply the newest pending inverse for this user. Returns what was reverted. */
export async function performUndo(actor: Actor): Promise<{ label: string; labelAr: string }> {
  const userId = actor.id;
  if (!userId) throw new ApiError(403, "Nothing to undo");

  const entry = await db.undoEntry.findFirst({
    where: { userId, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!entry) throw new ApiError(400, "Nothing to undo");
  if (entry.createdAt.getTime() < Date.now() - UNDO_WINDOW_MS) {
    /* the newest is expired ⇒ everything older is too: retire the lot so the
       button stops offering actions that can no longer be applied */
    await db.undoEntry.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    throw new ApiError(400, "That action is too old to undo");
  }

  await db.$transaction(async (tx) => {
    /* Consume FIRST and atomically: a racing double-click finds count 0. */
    const claimed = await tx.undoEntry.updateMany({
      where: { id: entry.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (claimed.count !== 1) throw new ApiError(409, "That action was already undone");

    /* Undo is ONE step back, not a history stack (ADR-045): applying it retires
       this user's other pending entries. Walking further back would offer
       inverses whose fingerprints this very undo has just invalidated. */
    await tx.undoEntry.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    if (entry.entityType === "lead") {
      const lead = await tx.lead.findUnique({ where: { id: entry.entityId } });
      if (!lead) throw new ApiError(400, CHANGED_SINCE);
      /* lead_create is the one kind whose fingerprint may legitimately differ
         from a later edit — but then the lead HAS changed, so the same rule
         applies: refuse. */
      if (lead.updatedAt.toISOString() !== entry.fingerprint) {
        throw new ApiError(409, CHANGED_SINCE);
      }
      await undoLead(tx, entry, lead, actor);
    } else if (isVaultEntityType(entry.entityType)) {
      /* ADR-053 — vault archive/restore: same fingerprint discipline, one
         generic inverse ({archived, archivedAt} put back exactly). */
      if ((entry.kind as UndoKind) !== "vault_archive") {
        throw new ApiError(400, "This action cannot be undone");
      }
      const delegate = VAULT_DELEGATES[entry.entityType](tx);
      const row = await delegate.findUnique({ where: { id: entry.entityId } });
      if (!row) throw new ApiError(400, CHANGED_SINCE);
      if (row.updatedAt.toISOString() !== entry.fingerprint) {
        throw new ApiError(409, CHANGED_SINCE);
      }
      const payload = entry.payload as { archived?: unknown; archivedAt?: unknown };
      await delegate.update({
        where: { id: entry.entityId },
        data: {
          archived: Boolean(payload.archived),
          archivedAt: payload.archivedAt ? new Date(String(payload.archivedAt)) : null,
        },
      });
    } else {
      const prospect = await tx.partnerProspect.findUnique({ where: { id: entry.entityId } });
      if (!prospect) throw new ApiError(400, CHANGED_SINCE);
      if (prospect.updatedAt.toISOString() !== entry.fingerprint) {
        throw new ApiError(409, CHANGED_SINCE);
      }
      await undoProspectEvent(tx, entry, actor);
    }

    await writeLog(tx, {
      entityType:
        entry.entityType === "lead"
          ? "lead"
          : isVaultEntityType(entry.entityType)
            ? entry.entityType
            : "partner_prospect",
      entityId: entry.entityId,
      actor,
      action: "update",
      trigger: "undo",
    });
  });

  return { label: entry.label, labelAr: entry.labelAr };
}

async function undoLead(
  tx: Prisma.TransactionClient,
  entry: { id: string; kind: string; entityId: string; payload: Prisma.JsonValue },
  lead: { id: string; stage: string },
  actor: Actor,
): Promise<void> {
  const payload = entry.payload as Record<string, unknown>;
  switch (entry.kind as UndoKind) {
    case "lead_event": {
      const snap = payload as unknown as StageEventSnapshot;
      await deleteCreated(tx, snap.created);
      await restoreUpdated(tx, snap.updated);
      await tx.lead.update({
        where: { id: lead.id },
        data: { stage: snap.stage, noAnswer: snap.noAnswer },
      });
      return;
    }
    case "lead_no_answer":
      await tx.lead.update({
        where: { id: lead.id },
        data: { noAnswer: Boolean(payload.noAnswer) },
      });
      return;
    case "lead_ready":
      await tx.lead.update({
        where: { id: lead.id },
        data: { readyToClose: Boolean(payload.readyToClose) },
      });
      return;
    case "lead_archive": {
      const archived = Boolean(payload.archived);
      const archivedAt = payload.archivedAt ? new Date(String(payload.archivedAt)) : null;
      await tx.lead.update({ where: { id: lead.id }, data: { archived, archivedAt } });
      return;
    }
    case "lead_assign": {
      /* Only the two OWNERSHIP columns go back. partnerId (the PP-5 referral
         attribution) was never part of the assignment, so it is not part of
         its inverse either. */
      await tx.lead.update({
        where: { id: lead.id },
        data: {
          ownerUserId: payload.ownerUserId ? String(payload.ownerUserId) : null,
          ownerType: String(payload.ownerType),
        },
      });
      return;
    }
    case "lead_update": {
      const snap = payload as unknown as LeadFieldsSnapshot;
      await tx.lead.update({ where: { id: lead.id }, data: snap.fields });
      return;
    }
    case "lead_create": {
      /* Only while it is still a bare lead — the moment it carries history,
         deleting it would destroy records the snapshot never captured. */
      const [followUps, meetings, proposals, lostInfo, notes, comments, wonInfo, wonDeal] =
        await Promise.all([
          tx.followUp.count({ where: { leadId: lead.id } }),
          tx.meeting.count({ where: { leadId: lead.id } }),
          tx.proposal.count({ where: { leadId: lead.id } }),
          tx.lostInfo.count({ where: { leadId: lead.id } }),
          tx.negotiationNote.count({ where: { leadId: lead.id } }),
          tx.leadComment.count({ where: { leadId: lead.id } }),
          tx.wonInfo.count({ where: { leadId: lead.id } }),
          tx.wonDeal.count({ where: { leadId: lead.id } }),
        ]);
      const children =
        followUps + meetings + proposals + lostInfo + notes + comments + wonInfo + wonDeal;
      if (children > 0) throw new ApiError(409, CHANGED_SINCE);
      await tx.lead.delete({ where: { id: lead.id } });
      return;
    }
    default:
      throw new ApiError(400, "This action cannot be undone");
  }
  void actor;
}

async function undoProspectEvent(
  tx: Prisma.TransactionClient,
  entry: { kind: string; entityId: string; payload: Prisma.JsonValue },
  actor: Actor,
): Promise<void> {
  if ((entry.kind as UndoKind) !== "prospect_event") {
    throw new ApiError(400, "This action cannot be undone");
  }
  const snap = entry.payload as unknown as StageEventSnapshot;
  /* ADR-057 — the runtime belt to the migration's braces. A snapshot written
     before the agent rename (or restored from an older backup) can name a
     stage this card's board no longer has; writing it back would strand the
     card in no column at all. Refuse instead. */
  const prospect = await tx.partnerProspect.findUnique({
    where: { id: entry.entityId },
    select: { kind: true },
  });
  if (!prospect || !partnersConfigFor(prospect.kind).stages.includes(snap.stage)) {
    throw new ApiError(400, CHANGED_SINCE);
  }
  await deleteCreated(tx, snap.created);
  await restoreUpdated(tx, snap.updated);
  await tx.partnerProspect.update({
    where: { id: entry.entityId },
    data: {
      stage: snap.stage,
      ...(snap.nonAnsweringNumbers !== undefined
        ? { nonAnsweringNumbers: snap.nonAnsweringNumbers }
        : {}),
    },
  });
  void actor;
}

async function deleteCreated(tx: Prisma.TransactionClient, created: CreatedRef[] = []) {
  for (const ref of created) {
    switch (ref.model) {
      case "followUp":
        await tx.followUp.deleteMany({ where: { id: ref.id } });
        break;
      case "meeting":
        await tx.meeting.deleteMany({ where: { id: ref.id } });
        break;
      case "proposal":
        await tx.proposal.deleteMany({ where: { id: ref.id } });
        break;
      case "lostInfo":
        await tx.lostInfo.deleteMany({ where: { id: ref.id } });
        break;
      case "wonInfo":
        await tx.wonInfo.deleteMany({ where: { id: ref.id } });
        break;
      case "negotiationNote":
        await tx.negotiationNote.deleteMany({ where: { id: ref.id } });
        break;
    }
  }
}

async function restoreUpdated(tx: Prisma.TransactionClient, updated: UpdatedRef[] = []) {
  for (const ref of updated) {
    if (ref.model === "meeting") {
      await tx.meeting.updateMany({
        where: { id: ref.id },
        data: {
          datetime: ref.datetime ? new Date(ref.datetime) : null,
          outcome: ref.outcome,
          outcomeDestination: ref.outcomeDestination,
        },
      });
    } else {
      await tx.proposal.updateMany({
        where: { id: ref.id },
        data: { sent: ref.sent, sentAt: ref.sentAt ? new Date(ref.sentAt) : null },
      });
    }
  }
}

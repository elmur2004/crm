import type { Prisma } from "../../../generated/prisma/client";
import type { LogAction, LogEntityType } from "@/lib/pipeline-engine/constants";

/* §5.6 — every stage change, automatic transfer, milestone check, and record
   creation writes an entry INSIDE the same transaction as the change (T-10). */

export type Actor = { id: string | null; label: string };

export const SYSTEM_ACTOR: Actor = { id: null, label: "System" };

export async function writeLog(
  tx: Prisma.TransactionClient,
  entry: {
    entityType: LogEntityType;
    entityId: string;
    actor: Actor;
    action: LogAction;
    fromStage?: string | null;
    toStage?: string | null;
    trigger: string;
  },
): Promise<void> {
  await tx.activityLog.create({
    data: {
      entityType: entry.entityType,
      entityId: entry.entityId,
      actorId: entry.actor.id,
      actorLabel: entry.actor.label,
      action: entry.action,
      fromStage: entry.fromStage ?? null,
      toStage: entry.toStage ?? null,
      trigger: entry.trigger,
    },
  });
}

/** `writeLog` for many entities in ONE statement — the same columns, mapped the
    same way. ADR-105: a mass hand-over writes one history row per lead, and
    hundreds of sequential inserts would outlast the transaction. */
export async function writeLogMany(
  tx: Prisma.TransactionClient,
  entries: Array<Parameters<typeof writeLog>[1]>,
): Promise<void> {
  if (entries.length === 0) return;
  await tx.activityLog.createMany({
    data: entries.map((entry) => ({
      entityType: entry.entityType,
      entityId: entry.entityId,
      actorId: entry.actor.id,
      actorLabel: entry.actor.label,
      action: entry.action,
      fromStage: entry.fromStage ?? null,
      toStage: entry.toStage ?? null,
      trigger: entry.trigger,
    })),
  });
}

export async function getHistory(
  db: Prisma.TransactionClient,
  entityType: LogEntityType,
  entityId: string,
) {
  return db.activityLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
  });
}

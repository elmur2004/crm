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

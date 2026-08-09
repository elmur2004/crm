import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import { storage } from "@/lib/storage";
import type { Actor } from "./activity";

/* Full-system backup & restore (founder directive): Export produces ONE JSON
   file holding every table (ids preserved) plus every uploaded file (base64).
   Import REPLACES the entire database with the backup's contents atomically —
   restoring an export onto a wiped system reproduces the system exactly.
   Admin-only at the route layer. The file contains password hashes — treat it
   as a secret. */

export const BACKUP_VERSION = 1;
const BACKUP_APP = "byteforce-bsystems-sales-platform";

/* FK-safe INSERT order (parents before children). Deletes run in reverse.
   Keep in sync with prisma/schema.prisma and src/tests/db-reset.ts. */
const MODELS = [
  "user",
  "userRole",
  "salesRep",
  "portalRep",
  "partnerProspect",
  "partner",
  "lead",
  "followUp",
  "meeting",
  "proposal",
  "lostInfo",
  "wonInfo",
  "client",
  "wonDeal",
  "milestone",
  "statement",
  "negotiationNote",
  "notification",
  "attachment",
  "activityLog",
] as const;
type ModelName = (typeof MODELS)[number];

type AnyDelegate = {
  findMany: (args?: unknown) => Promise<Record<string, unknown>[]>;
  deleteMany: () => Promise<unknown>;
  createMany: (args: { data: Record<string, unknown>[] }) => Promise<unknown>;
};
function delegate(client: unknown, model: ModelName): AnyDelegate {
  return (client as Record<ModelName, AnyDelegate>)[model];
}

export interface BackupFilePayload {
  version: number;
  app: string;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
  files: Array<{ key: string; data: string }>; // base64
}

export async function exportBackup(): Promise<BackupFilePayload> {
  const tables: BackupFilePayload["tables"] = {};
  for (const model of MODELS) {
    tables[model] = await delegate(db, model).findMany();
  }

  /* every stored upload, keyed exactly as the Attachment rows reference it —
     a missing file on disk is skipped (the row still restores) */
  const files: BackupFilePayload["files"] = [];
  const attachments = tables["attachment"] as Array<{ storageKey: string }>;
  for (const a of attachments) {
    try {
      const buf = await storage.read(a.storageKey);
      files.push({ key: a.storageKey, data: buf.toString("base64") });
    } catch {
      // file lost on disk — the restore recreates the row without the blob
    }
  }

  return {
    version: BACKUP_VERSION,
    app: BACKUP_APP,
    exportedAt: new Date().toISOString(),
    tables,
    files,
  };
}

/** REPLACES all data with the backup's contents. Ids are preserved, so every
    relation (and the signed-in admin's session) survives the round-trip. */
export async function importBackup(
  raw: unknown,
  actor: Actor,
): Promise<Record<string, number>> {
  const payload = raw as Partial<BackupFilePayload> | null;
  if (
    !payload ||
    payload.app !== BACKUP_APP ||
    typeof payload.version !== "number" ||
    !payload.tables ||
    typeof payload.tables !== "object"
  ) {
    throw new ApiError(400, "Not a valid backup file for this system");
  }
  if (payload.version > BACKUP_VERSION) {
    throw new ApiError(400, "This backup was made by a newer version of the system");
  }

  const counts: Record<string, number> = {};
  await db.$transaction(async (tx) => {
    for (const model of [...MODELS].reverse()) {
      await delegate(tx, model).deleteMany();
    }
    for (const model of MODELS) {
      const rows = payload.tables![model] ?? [];
      counts[model] = rows.length;
      if (rows.length > 0) {
        // Prisma coerces ISO-8601 strings back into DateTime columns
        await delegate(tx, model).createMany({ data: rows });
      }
    }
    await tx.activityLog.create({
      data: {
        entityType: "user",
        entityId: actor.id ?? "system",
        actorId: actor.id,
        actorLabel: actor.label,
        action: "update",
        trigger: "backup_import",
      },
    });
  });

  /* uploaded files after the rows commit — a failed blob never aborts the data */
  for (const f of payload.files ?? []) {
    try {
      await storage.put(f.key, Buffer.from(f.data, "base64"));
    } catch {
      // bad key/blob — the attachment row exists; the file 404s until re-uploaded
    }
  }

  return counts;
}

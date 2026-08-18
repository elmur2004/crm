import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import { storage } from "@/lib/storage";
import { writeLog, type Actor } from "@/lib/services/activity";
import { invalidateUndo } from "@/lib/services/undo";

/* ============================================================================
   VAULT MODULE BACKUP (ADR-054, founder directive B): module-scoped export /
   import, mirroring the global backup pattern (src/lib/services/backup.ts)
   but VAULT-ONLY — the five Vault* models, the Attachment rows that belong to
   vault records (vaultSheetId / vaultDocumentId / vaultTaskId set), and those
   attachments' files as base64. Import REPLACES the vault's data atomically
   (rows in one transaction; blobs after commit, same as the global restore),
   preserves ids so every relation survives, logs to ActivityLog and consumes
   pending undo entries (a whole-module replacement is not undoable, the
   ADR-045/ADR-052 rule). Admin-only at the route layer.
   ========================================================================== */

export const VAULT_BACKUP_VERSION = 1;
const VAULT_BACKUP_APP = "byteforce-bsystems-sales-platform-vault";

/* FK-safe INSERT order (parents before children); deletes run in reverse. */
const VAULT_MODELS = [
  "vaultEmployee",
  "vaultForm",
  "vaultSheet",
  "vaultDocument",
  "vaultTask",
] as const;
type VaultModelName = (typeof VAULT_MODELS)[number];

/** an Attachment row belongs to the vault iff one of its vault FKs is set */
const VAULT_ATTACHMENT_WHERE = {
  OR: [
    { vaultSheetId: { not: null } },
    { vaultDocumentId: { not: null } },
    { vaultTaskId: { not: null } },
  ],
} as const;

type AnyDelegate = {
  findMany: (args?: unknown) => Promise<Record<string, unknown>[]>;
  deleteMany: (args?: unknown) => Promise<unknown>;
  createMany: (args: { data: Record<string, unknown>[] }) => Promise<unknown>;
};
function delegate(client: unknown, model: VaultModelName | "attachment"): AnyDelegate {
  return (client as Record<string, AnyDelegate>)[model]!;
}

export interface VaultBackupPayload {
  version: number;
  app: string;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
  files: Array<{ key: string; data: string }>; // base64
}

export async function exportVault(actor: Actor): Promise<VaultBackupPayload> {
  const tables: VaultBackupPayload["tables"] = {};
  for (const model of VAULT_MODELS) {
    tables[model] = await delegate(db, model).findMany();
  }
  tables["attachment"] = await delegate(db, "attachment").findMany({
    where: VAULT_ATTACHMENT_WHERE,
  });

  /* every vault upload, keyed exactly as its Attachment row references it —
     a missing file on disk is skipped (the row still restores) */
  const files: VaultBackupPayload["files"] = [];
  for (const a of tables["attachment"] as Array<{ storageKey: string }>) {
    try {
      const buf = await storage.read(a.storageKey);
      files.push({ key: a.storageKey, data: buf.toString("base64") });
    } catch {
      // file lost on disk — the restore recreates the row without the blob
    }
  }

  await db.$transaction(async (tx) => {
    await writeLog(tx, {
      entityType: "vault_backup",
      entityId: "vault",
      actor,
      action: "export",
      trigger: "vault_export",
    });
  });

  return {
    version: VAULT_BACKUP_VERSION,
    app: VAULT_BACKUP_APP,
    exportedAt: new Date().toISOString(),
    tables,
    files,
  };
}

/** REPLACES the vault's data (rows + files) with the backup's contents. */
export async function importVault(
  raw: unknown,
  actor: Actor,
): Promise<Record<string, number>> {
  const payload = raw as Partial<VaultBackupPayload> | null;
  if (
    !payload ||
    payload.app !== VAULT_BACKUP_APP ||
    typeof payload.version !== "number" ||
    !payload.tables ||
    typeof payload.tables !== "object"
  ) {
    throw new ApiError(400, "Not a valid vault export file for this system");
  }
  if (payload.version > VAULT_BACKUP_VERSION) {
    throw new ApiError(400, "This vault export was made by a newer version of the system");
  }

  const counts: Record<string, number> = {};
  await db.$transaction(async (tx) => {
    /* children before parents: vault attachments, then the models reversed */
    await delegate(tx, "attachment").deleteMany({ where: VAULT_ATTACHMENT_WHERE });
    for (const model of [...VAULT_MODELS].reverse()) {
      await delegate(tx, model).deleteMany();
    }
    for (const model of VAULT_MODELS) {
      const rows = payload.tables![model] ?? [];
      counts[model] = rows.length;
      if (rows.length > 0) {
        // Prisma coerces ISO-8601 strings back into DateTime columns
        await delegate(tx, model).createMany({ data: rows });
      }
    }
    const attachmentRows = payload.tables!["attachment"] ?? [];
    counts["attachment"] = attachmentRows.length;
    if (attachmentRows.length > 0) {
      await delegate(tx, "attachment").createMany({ data: attachmentRows });
    }
    await writeLog(tx, {
      entityType: "vault_backup",
      entityId: "vault",
      actor,
      action: "import",
      trigger: "vault_import",
    });
    /* a whole-module replacement is not undoable — retire pending undo rows */
    await invalidateUndo(tx, actor);
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

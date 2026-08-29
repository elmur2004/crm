import { db } from "@/lib/db";
import type { Prisma } from "../../../../generated/prisma/client";
import { ApiError } from "@/lib/api-error";
import { formatMsg } from "@/lib/i18n/core";
import { undoLabels } from "@/lib/i18n/dict/undo";
import { writeLog, type Actor } from "../activity";
import { recordUndo } from "../undo";
import type { VaultArchiveKind } from "./constants";

/* ADR-053 — nothing in the vault is hard deleted, anywhere (the reference
   BR-11, the CRM's own ADR-043 pattern). "Delete" in the interface means
   archive: the record leaves every default list and count, keeps its data, and
   the Archive screen restores it. There is no delete() call for any vault
   entity in this codebase, and there must never be one.

   Archive/restore are the vault's SAFE mutations, so they are the ones wired
   into undo (snapshot-inverse of {archived, archivedAt}, ADR-045 discipline). */

type ArchivableRow = {
  id: string;
  name: string;
  archived: boolean;
  archivedAt: Date | null;
  updatedAt: Date;
};

type ArchivableDelegate = {
  findUnique(args: { where: { id: string } }): Promise<ArchivableRow | null>;
  update(args: {
    where: { id: string };
    data: { archived: boolean; archivedAt: Date | null };
  }): Promise<ArchivableRow>;
};

const DELEGATES: Record<VaultArchiveKind, (tx: Prisma.TransactionClient) => ArchivableDelegate> = {
  vault_form: (tx) => tx.vaultForm,
  vault_link: (tx) => tx.vaultLink,
  vault_sheet: (tx) => tx.vaultSheet,
  vault_document: (tx) => tx.vaultDocument,
  vault_task: (tx) => tx.vaultTask,
};

/** ADR-043 hardening, vault edition: an archived record is READ-ONLY except
    restore itself — no edits, no file replacements, no completion. */
export function assertNotArchived(row: { archived: boolean }): void {
  if (row.archived) throw new ApiError(400, "Restore this record from the archive first");
}

export async function setVaultArchived(
  kind: VaultArchiveKind,
  id: string,
  value: boolean,
  actor: Actor,
) {
  return db.$transaction(async (tx) => {
    const delegate = DELEGATES[kind](tx);
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Record not found");
    if (existing.archived === value) return existing;

    const fresh = await delegate.update({
      where: { id },
      data: { archived: value, archivedAt: value ? new Date() : null },
    });

    // Same transaction as the change it records (append-only provenance).
    await writeLog(tx, {
      entityType: kind,
      entityId: id,
      actor,
      action: value ? "archive" : "restore",
      trigger: value ? "archived" : "restored",
    });

    const label = formatMsg(value ? undoLabels.archived : undoLabels.unarchived, {
      name: existing.name,
    });
    await recordUndo({
      tx,
      actor,
      kind: "vault_archive",
      entityType: kind,
      entityId: id,
      fingerprint: fresh.updatedAt,
      label: label.en,
      labelAr: label.ar,
      payload: {
        archived: existing.archived,
        archivedAt: existing.archivedAt ? existing.archivedAt.toISOString() : null,
      },
    });

    return fresh;
  });
}

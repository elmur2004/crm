import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "../../../../generated/prisma/client";
import { ApiError } from "@/lib/api-error";
import { storage as blobStorage, validateAndStore } from "@/lib/storage";
import { writeLog, type Actor } from "../activity";
import { invalidateUndo } from "../undo";
import { assertNotArchived, setVaultArchived } from "./archive";
import { optionalText, vaultListParams, zVaultCompany } from "./common";
import { VAULT_DOCUMENT_TYPES } from "./constants";

/* ADR-053 — vault documents (the reference SPEC §8.2): a typed, company-tagged
   file. The file is REQUIRED (a document without a file is a name), stored as
   an Attachment row (kind vault_document); replacing APPENDS a new row so
   the previous versions stay servable — newest = current. */

export const vaultDocumentSchema = z.object({
  company: zVaultCompany,
  name: z.string().trim().min(1, "Give the document a name.").max(160),
  description: optionalText(5000),
  type: z.enum(VAULT_DOCUMENT_TYPES),
});
export type VaultDocumentInput = z.infer<typeof vaultDocumentSchema>;

export const vaultDocumentListParams = vaultListParams.extend({
  type: z.enum(VAULT_DOCUMENT_TYPES).optional().catch(undefined),
});
export type VaultDocumentListParams = z.infer<typeof vaultDocumentListParams>;

export async function listVaultDocuments(params: VaultDocumentListParams) {
  const where: Prisma.VaultDocumentWhereInput = {
    archived: params.archived,
    ...(params.company ? { company: params.company } : {}),
    ...(params.type ? { type: params.type } : {}),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: "insensitive" } },
            { description: { contains: params.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  return db.vaultDocument.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { files: { orderBy: { createdAt: "desc" } } },
  });
}

export async function getVaultDocument(id: string) {
  const doc = await db.vaultDocument.findUnique({
    where: { id },
    include: { files: { orderBy: { createdAt: "desc" } } },
  });
  if (!doc) throw new ApiError(404, "Document not found");
  return doc;
}

export async function createVaultDocument(input: VaultDocumentInput, file: File, actor: Actor) {
  const stored = await validateAndStore("vault_document", file);
  try {
    return await db.$transaction(async (tx) => {
      const doc = await tx.vaultDocument.create({
        data: {
          company: input.company,
          name: input.name,
          description: input.description,
          type: input.type,
        },
      });
      await tx.attachment.create({
        data: {
          kind: "vault_document",
          vaultDocumentId: doc.id,
          filename: stored.filename,
          storageKey: stored.key,
          mime: stored.mime,
          size: stored.size,
        },
      });
      await writeLog(tx, {
        entityType: "vault_document",
        entityId: doc.id,
        actor,
        action: "create",
        trigger: "vault_document_create",
      });
      await invalidateUndo(tx, actor);
      return doc;
    });
  } catch (err) {
    await blobStorage.delete(stored.key); // no orphaned blob behind a failed row
    throw err;
  }
}

/** Metadata edit — the file rides its own replace call. */
export async function updateVaultDocument(id: string, input: VaultDocumentInput, actor: Actor) {
  const before = await db.vaultDocument.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Document not found");
  assertNotArchived(before);
  return db.$transaction(async (tx) => {
    const doc = await tx.vaultDocument.update({
      where: { id },
      data: {
        company: input.company,
        name: input.name,
        description: input.description,
        type: input.type,
      },
    });
    await writeLog(tx, {
      entityType: "vault_document",
      entityId: id,
      actor,
      action: "update",
      trigger: "vault_document_update",
    });
    await invalidateUndo(tx, actor);
    return doc;
  });
}

/** Replace the document's file (reference FR-D06): APPEND, never overwrite. */
export async function replaceVaultDocumentFile(id: string, file: File, actor: Actor) {
  const before = await getVaultDocument(id);
  assertNotArchived(before);
  const stored = await validateAndStore("vault_document", file);
  try {
    return await db.$transaction(async (tx) => {
      await tx.attachment.create({
        data: {
          kind: "vault_document",
          vaultDocumentId: id,
          filename: stored.filename,
          storageKey: stored.key,
          mime: stored.mime,
          size: stored.size,
        },
      });
      await writeLog(tx, {
        entityType: "vault_document",
        entityId: id,
        actor,
        action: "replace_file",
        trigger: `version ${before.files.length + 1}`,
      });
      await invalidateUndo(tx, actor);
      return getFresh(tx, id);
    });
  } catch (err) {
    await blobStorage.delete(stored.key);
    throw err;
  }
}

function getFresh(tx: Prisma.TransactionClient, id: string) {
  return tx.vaultDocument.findUniqueOrThrow({
    where: { id },
    include: { files: { orderBy: { createdAt: "desc" } } },
  });
}

export const archiveVaultDocument = (id: string, actor: Actor) =>
  setVaultArchived("vault_document", id, true, actor);
export const restoreVaultDocument = (id: string, actor: Actor) =>
  setVaultArchived("vault_document", id, false, actor);

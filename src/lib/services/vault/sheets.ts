import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "../../../../generated/prisma/client";
import { ApiError } from "@/lib/api-error";
import { storage as blobStorage, validateAndStore } from "@/lib/storage";
import { utcToCairo } from "@/lib/datetime";
import { writeLog, type Actor } from "../activity";
import { invalidateUndo } from "../undo";
import { assertNotArchived, setVaultArchived } from "./archive";
import { countRecords } from "./row-count";
import {
  optionalText,
  vaultListParams,
  zHttpUrl,
  zVaultCompany,
  zVaultDate,
} from "./common";
import { VAULT_SHEET_TYPES, type VaultCompany } from "./constants";
import { vaultCompanyWhere } from "./tenancy";

/* ADR-053 — vault sheets (the reference SPEC §8.1). The two invariants:

   1. LINK XOR FILE (reference BR-02/AC-03): a sheet stores exactly one of an
      http(s) URL or an uploaded file — never both, never neither. Expressed as
      a Zod discriminated union so invalid states are unrepresentable at the
      boundary, AND re-asserted here in the service against the final row state
      (the server never trusts what it was sent).
   2. COUNT + AS-OF (reference BR-03/AC-04): a CSV upload is counted from the
      file itself (as-of = today, Cairo); a manual count requires the date it
      was accurate. XLSX/XLS keep the manual path — see row-count.ts.

   Files live as Attachment rows (kind vault_sheet). Replacing APPENDS a row —
   the predecessors stay servable, newest = current (never-delete for files). */

const sheetBase = z.object({
  company: zVaultCompany,
  name: z.string().trim().min(1, "Give the sheet a name.").max(160),
  type: z.enum(VAULT_SHEET_TYPES),
  dateCreated: zVaultDate,
  notes: optionalText(5000),
  recordCount: z.coerce.number().int().min(0).max(100_000_000).nullish(),
  recordCountAsOf: zVaultDate.nullish(),
});

export const vaultSheetSchema = z
  .discriminatedUnion("storage", [
    sheetBase.extend({ storage: z.literal("link"), url: zHttpUrl }),
    /* FILE mode: the bytes arrive as multipart alongside the fields — presence
       is enforced by the route and re-asserted by the service invariant. */
    sheetBase.extend({ storage: z.literal("file") }),
  ])
  .superRefine((value, ctx) => {
    if (value.recordCount != null && !value.recordCountAsOf) {
      ctx.addIssue({
        code: "custom",
        path: ["recordCountAsOf"],
        message: "Add the date this count was accurate — an undated number is not useful.",
      });
    }
  });
export type VaultSheetInput = z.infer<typeof vaultSheetSchema>;

export const vaultSheetListParams = vaultListParams.extend({
  type: z.enum(VAULT_SHEET_TYPES).optional().catch(undefined),
});
export type VaultSheetListParams = z.infer<typeof vaultSheetListParams>;

export async function listVaultSheets(
  params: VaultSheetListParams,
  /* ADR-074 — `visible` is the tenancy wall (services/vault/tenancy.ts).
     REQUIRED, never defaulted: a default would be "the whole platform", which
     is exactly the leak this argument exists to close. */
  visible: readonly VaultCompany[],
) {
  const where: Prisma.VaultSheetWhereInput = {
    archived: params.archived,
    ...vaultCompanyWhere(visible, params.company),
    ...(params.type ? { type: params.type } : {}),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: "insensitive" } },
            { notes: { contains: params.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  return db.vaultSheet.findMany({
    where,
    orderBy: { dateCreated: "desc" },
    include: { files: { orderBy: { createdAt: "desc" } } },
  });
}

export async function getVaultSheet(id: string) {
  const sheet = await db.vaultSheet.findUnique({
    where: { id },
    include: { files: { orderBy: { createdAt: "desc" } } },
  });
  if (!sheet) throw new ApiError(404, "Sheet not found");
  return sheet;
}

/** The XOR invariant, asserted against the FINAL state of the row. */
function assertStorageExclusive(row: { storage: string; url: string | null }, fileCount: number) {
  const hasUrl = row.storage === "link" && Boolean(row.url);
  const hasFile = row.storage === "file" && fileCount > 0;
  if (hasUrl === hasFile) {
    throw new ApiError(
      422,
      "A sheet needs either a link or an uploaded file — one of the two, not both and not neither.",
    );
  }
}

/** Store + count in one step. Returns Attachment-ready fields + the count. */
async function storeSheetFile(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await validateAndStore("vault_sheet", file);
  const detectedExt = stored.key.split(".").pop() ?? "";
  const counted = countRecords(buffer, detectedExt);
  return { stored, counted };
}

function countFields(
  counted: { count: number; countable: boolean },
  manual: { recordCount?: number | null; recordCountAsOf?: string | null },
) {
  if (counted.countable) {
    // Auto-counted from the file: as-of is today (Cairo), reference AC-04.
    return { recordCount: counted.count, recordCountAsOf: utcToCairo(new Date()).date };
  }
  return {
    recordCount: manual.recordCount ?? null,
    recordCountAsOf: manual.recordCount != null ? (manual.recordCountAsOf ?? null) : null,
  };
}

export async function createVaultSheet(input: VaultSheetInput, file: File | null, actor: Actor) {
  if (input.storage === "file" && !file) {
    throw new ApiError(422, "Choose a file to upload — or store the sheet as a link.");
  }
  if (input.storage === "link" && file) {
    throw new ApiError(422, "A linked sheet cannot also carry an uploaded file.");
  }

  const upload = input.storage === "file" && file ? await storeSheetFile(file) : null;

  try {
    return await db.$transaction(async (tx) => {
      const data = {
        company: input.company,
        name: input.name,
        type: input.type,
        storage: input.storage,
        url: input.storage === "link" ? input.url : null,
        dateCreated: input.dateCreated,
        notes: input.notes,
        ...(upload
          ? countFields(upload.counted, input)
          : {
              recordCount: input.recordCount ?? null,
              recordCountAsOf: input.recordCount != null ? (input.recordCountAsOf ?? null) : null,
            }),
      };
      assertStorageExclusive(data, upload ? 1 : 0);

      const sheet = await tx.vaultSheet.create({ data });
      if (upload) {
        await tx.attachment.create({
          data: {
            kind: "vault_sheet",
            vaultSheetId: sheet.id,
            filename: upload.stored.filename,
            storageKey: upload.stored.key,
            mime: upload.stored.mime,
            size: upload.stored.size,
          },
        });
      }
      await writeLog(tx, {
        entityType: "vault_sheet",
        entityId: sheet.id,
        actor,
        action: "create",
        trigger: "vault_sheet_create",
      });
      await invalidateUndo(tx, actor);
      return sheet;
    });
  } catch (err) {
    // Never leave an orphaned blob behind a failed row (reference failure UX).
    if (upload) await blobStorage.delete(upload.stored.key);
    throw err;
  }
}

/** Metadata edit (and link↔file switching; the file itself arrives via
    replaceVaultSheetFile, which also flips a linked sheet to file mode). */
export async function updateVaultSheet(id: string, input: VaultSheetInput, actor: Actor) {
  const before = await getVaultSheet(id);
  assertNotArchived(before);

  const latest = before.files[0] ?? null;
  const latestExt = latest ? (latest.storageKey.split(".").pop() ?? "") : "";
  const hasAutoCount = before.storage === "file" && latestExt === "csv";

  return db.$transaction(async (tx) => {
    const data = {
      company: input.company,
      name: input.name,
      type: input.type,
      storage: input.storage,
      url: input.storage === "link" ? input.url : null,
      dateCreated: input.dateCreated,
      notes: input.notes,
      /* an auto-counted sheet keeps its computed number — recounts happen on
         file replacement, not on metadata edits (reference FR-S05) */
      ...(input.storage === "file" && hasAutoCount
        ? {}
        : {
            recordCount: input.recordCount ?? null,
            recordCountAsOf: input.recordCount != null ? (input.recordCountAsOf ?? null) : null,
          }),
    };
    assertStorageExclusive(data, before.files.length);

    const sheet = await tx.vaultSheet.update({ where: { id }, data });
    await writeLog(tx, {
      entityType: "vault_sheet",
      entityId: id,
      actor,
      action: "update",
      trigger: "vault_sheet_update",
    });
    await invalidateUndo(tx, actor);
    return sheet;
  });
}

/**
 * Upload/replace the sheet's file (reference FR-S06): the new Attachment row is
 * APPENDED — the previous version stays servable — and a CSV is re-counted.
 * Called on a linked sheet, it also switches it to file mode (url cleared).
 */
export async function replaceVaultSheetFile(id: string, file: File, actor: Actor) {
  const before = await getVaultSheet(id);
  assertNotArchived(before);

  const upload = await storeSheetFile(file);
  try {
    return await db.$transaction(async (tx) => {
      await tx.attachment.create({
        data: {
          kind: "vault_sheet",
          vaultSheetId: id,
          filename: upload.stored.filename,
          storageKey: upload.stored.key,
          mime: upload.stored.mime,
          size: upload.stored.size,
        },
      });
      const sheet = await tx.vaultSheet.update({
        where: { id },
        data: {
          storage: "file",
          url: null,
          ...countFields(upload.counted, {
            recordCount: before.recordCount,
            recordCountAsOf: before.recordCountAsOf,
          }),
        },
      });
      await writeLog(tx, {
        entityType: "vault_sheet",
        entityId: id,
        actor,
        action: "replace_file",
        trigger: `version ${before.files.length + 1}`,
      });
      await invalidateUndo(tx, actor);
      return sheet;
    });
  } catch (err) {
    await blobStorage.delete(upload.stored.key);
    throw err;
  }
}

export const archiveVaultSheet = (id: string, actor: Actor) =>
  setVaultArchived("vault_sheet", id, true, actor);
export const restoreVaultSheet = (id: string, actor: Actor) =>
  setVaultArchived("vault_sheet", id, false, actor);

import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "../../../../generated/prisma/client";
import { ApiError } from "@/lib/api-error";
import { writeLog, type Actor } from "../activity";
import { invalidateUndo } from "../undo";
import { assertNotArchived, setVaultArchived } from "./archive";
import { optionalText, vaultListParams, zHttpUrl, zVaultCompany, type VaultListParams } from "./common";
import { vaultCompanyWhere } from "./tenancy";
import type { VaultCompany } from "./constants";

/* ADR-053 — vault forms (the reference SPEC §7): a named link to an external
   form, company-tagged, with the duplicate-URL HANDSHAKE (reference FR-F08):
   the same URL on another live form is a WARNING, not a block — the server
   answers 409 with the clashing form's name, and the client may re-submit with
   acknowledgeDuplicate to file it anyway (duplicates are sometimes legitimate:
   one form filed under two names). */

export const vaultFormSchema = z.object({
  company: zVaultCompany,
  name: z.string().trim().min(1, "Give the form a name.").max(160),
  url: zHttpUrl,
  notes: optionalText(5000),
  acknowledgeDuplicate: z.coerce.boolean().optional().default(false),
});
export type VaultFormInput = z.infer<typeof vaultFormSchema>;

export async function listVaultForms(
  params: VaultListParams,
  /* ADR-074 — `visible` is the tenancy wall (services/vault/tenancy.ts).
     REQUIRED, never defaulted: a default would be "the whole platform", which
     is exactly the leak this argument exists to close. */
  visible: readonly VaultCompany[],
) {
  const where: Prisma.VaultFormWhereInput = {
    archived: params.archived,
    ...vaultCompanyWhere(visible, params.company),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: "insensitive" } },
            { notes: { contains: params.q, mode: "insensitive" } },
            { url: { contains: params.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  return db.vaultForm.findMany({ where, orderBy: { createdAt: "desc" } });
}

export const vaultFormListParams = vaultListParams;

/** The duplicate-URL check — live (non-archived) forms only, excluding self.

    ADR-074 — SCOPED. The 409 body names the clashing form, so unscoped this was
    an existence oracle with a label on it: paste a URL, read back another
    company's form NAME. Warning somebody about a record they cannot see is also
    useless advice — they cannot go and look at it. */
export async function findDuplicateFormUrl(
  url: string,
  /* ADR-074 — the tenancy wall (services/vault/tenancy.ts). REQUIRED. */
  visible: readonly VaultCompany[],
  exceptId?: string,
) {
  return db.vaultForm.findFirst({
    where: {
      url,
      archived: false,
      ...vaultCompanyWhere(visible, undefined),
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true, name: true },
  });
}

async function assertUrlAcknowledged(
  input: VaultFormInput,
  visible: readonly VaultCompany[],
  exceptId?: string,
) {
  if (input.acknowledgeDuplicate) return;
  const clash = await findDuplicateFormUrl(input.url, visible, exceptId);
  if (clash) {
    /* 409 = the handshake: the client shows the clash and may re-submit with
       acknowledgeDuplicate=true. Warn, never block (reference FR-F08). */
    throw new ApiError(409, `This URL is already on "${clash.name}" — save again to keep both.`);
  }
}

export async function createVaultForm(
  input: VaultFormInput,
  /* ADR-074 — the tenancy wall (services/vault/tenancy.ts). REQUIRED. */
  visible: readonly VaultCompany[],
  actor: Actor,
) {
  await assertUrlAcknowledged(input, visible);
  return db.$transaction(async (tx) => {
    const form = await tx.vaultForm.create({
      data: { company: input.company, name: input.name, url: input.url, notes: input.notes },
    });
    await writeLog(tx, {
      entityType: "vault_form",
      entityId: form.id,
      actor,
      action: "create",
      trigger: "vault_form_create",
    });
    await invalidateUndo(tx, actor);
    return form;
  });
}

export async function updateVaultForm(
  id: string,
  input: VaultFormInput,
  /* ADR-074 — the tenancy wall (services/vault/tenancy.ts). REQUIRED. */
  visible: readonly VaultCompany[],
  actor: Actor,
) {
  const before = await db.vaultForm.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Form not found");
  assertNotArchived(before);
  await assertUrlAcknowledged(input, visible, id);
  return db.$transaction(async (tx) => {
    const form = await tx.vaultForm.update({
      where: { id },
      data: { company: input.company, name: input.name, url: input.url, notes: input.notes },
    });
    await writeLog(tx, {
      entityType: "vault_form",
      entityId: id,
      actor,
      action: "update",
      trigger: "vault_form_update",
    });
    await invalidateUndo(tx, actor);
    return form;
  });
}

export const archiveVaultForm = (id: string, actor: Actor) =>
  setVaultArchived("vault_form", id, true, actor);
export const restoreVaultForm = (id: string, actor: Actor) =>
  setVaultArchived("vault_form", id, false, actor);

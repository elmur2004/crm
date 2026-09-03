import { handleRoute, requireVault } from "@/lib/auth/guards";
import { assertVaultCompany } from "@/lib/services/vault/tenancy";
import { createVaultSheet, vaultSheetSchema } from "@/lib/services/vault/sheets";
import { fieldFile, fieldStr } from "@/lib/services/vault/multipart";

/* ADR-053 — create a sheet (multipart: fields + optional file). The XOR rule
   (link or file, never both/neither) is the Zod union + a service assertion. */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireVault();
  const form = await req.formData();
  const input = vaultSheetSchema.parse({
    company: fieldStr(form, "company"),
    name: fieldStr(form, "name"),
    type: fieldStr(form, "type"),
    storage: fieldStr(form, "storage"),
    url: fieldStr(form, "url"),
    dateCreated: fieldStr(form, "dateCreated"),
    notes: fieldStr(form, "notes"),
    recordCount: fieldStr(form, "recordCount"),
    recordCountAsOf: fieldStr(form, "recordCountAsOf"),
  });
  /* ADR-074 — the payload names a company; it must be one this
     account holds (services/vault/tenancy.ts). */
  assertVaultCompany(user, input.company);
  const row = await createVaultSheet(input, fieldFile(form), {
    id: user.id,
    label: user.name,
  });
  return Response.json(row, { status: 201 });
});

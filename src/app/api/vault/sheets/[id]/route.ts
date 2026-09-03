import { handleRoute, requireVault } from "@/lib/auth/guards";
import { assertVaultCompany, assertVaultRowVisible } from "@/lib/services/vault/tenancy";
import { updateVaultSheet, vaultSheetSchema } from "@/lib/services/vault/sheets";

/* ADR-053 — metadata edit (JSON). The file itself rides POST [id]/file. */

export const PATCH = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireVault();
    const { id } = await ctx.params;
    /* ADR-074 — this record must belong to a company this account can
       see; an id alone is no longer proof of that. */
    await assertVaultRowVisible(user, "sheet", id);
    const input = vaultSheetSchema.parse(await req.json());
    /* ADR-074 — the payload names a company; it must be one this
       account holds (services/vault/tenancy.ts). */
    assertVaultCompany(user, input.company);
    return Response.json(await updateVaultSheet(id, input, { id: user.id, label: user.name }));
  },
);

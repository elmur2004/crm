import { ApiError } from "@/lib/api-error";
import { handleRoute, requireVault } from "@/lib/auth/guards";
import { assertVaultRowVisible } from "@/lib/services/vault/tenancy";
import { replaceVaultSheetFile } from "@/lib/services/vault/sheets";
import { fieldFile } from "@/lib/services/vault/multipart";

/* ADR-053 — upload/replace the sheet's file: APPENDS a version (predecessors
   stay servable), re-counts a CSV, flips a linked sheet to file mode. */

export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireVault();
    const { id } = await ctx.params;
    /* ADR-074 — this record must belong to a company this account can
       see; an id alone is no longer proof of that. */
    await assertVaultRowVisible(user, "sheet", id);
    const file = fieldFile(await req.formData());
    if (!file) throw new ApiError(400, "No file provided");
    return Response.json(await replaceVaultSheetFile(id, file, { id: user.id, label: user.name }));
  },
);

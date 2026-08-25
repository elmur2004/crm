import { handleRoute, requireVault } from "@/lib/auth/guards";
import { updateVaultSheet, vaultSheetSchema } from "@/lib/services/vault/sheets";

/* ADR-053 — metadata edit (JSON). The file itself rides POST [id]/file. */

export const PATCH = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireVault();
    const { id } = await ctx.params;
    const input = vaultSheetSchema.parse(await req.json());
    return Response.json(await updateVaultSheet(id, input, { id: user.id, label: user.name }));
  },
);

import { handleRoute, requireVault } from "@/lib/auth/guards";
import { updateVaultDocument, vaultDocumentSchema } from "@/lib/services/vault/documents";

export const PATCH = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireVault();
    const { id } = await ctx.params;
    const input = vaultDocumentSchema.parse(await req.json());
    return Response.json(await updateVaultDocument(id, input, { id: user.id, label: user.name }));
  },
);

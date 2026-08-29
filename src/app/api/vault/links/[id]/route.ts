import { handleRoute, requireVault } from "@/lib/auth/guards";
import { updateVaultLink, vaultLinkSchema } from "@/lib/services/vault/links";

export const PATCH = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireVault();
    const { id } = await ctx.params;
    const input = vaultLinkSchema.parse(await req.json());
    return Response.json(await updateVaultLink(id, input, { id: user.id, label: user.name }));
  },
);

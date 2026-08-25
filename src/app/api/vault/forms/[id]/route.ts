import { handleRoute, requireVault } from "@/lib/auth/guards";
import { updateVaultForm, vaultFormSchema } from "@/lib/services/vault/forms";

export const PATCH = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireVault();
    const { id } = await ctx.params;
    const input = vaultFormSchema.parse(await req.json());
    return Response.json(await updateVaultForm(id, input, { id: user.id, label: user.name }));
  },
);

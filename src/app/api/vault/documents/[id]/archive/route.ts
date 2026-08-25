import { z } from "zod";
import { handleRoute, requireVault } from "@/lib/auth/guards";
import { setVaultArchived } from "@/lib/services/vault/archive";

const schema = z.object({ value: z.boolean() });

export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireVault();
    const { id } = await ctx.params;
    const { value } = schema.parse(await req.json());
    return Response.json(
      await setVaultArchived("vault_document", id, value, { id: user.id, label: user.name }),
    );
  },
);

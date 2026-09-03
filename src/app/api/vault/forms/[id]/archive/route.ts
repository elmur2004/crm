import { z } from "zod";
import { handleRoute, requireVault } from "@/lib/auth/guards";
import { assertVaultRowVisible } from "@/lib/services/vault/tenancy";
import { setVaultArchived } from "@/lib/services/vault/archive";

/* ADR-053 — archive/restore ({ value: true|false }); never a hard delete. */

const schema = z.object({ value: z.boolean() });

export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireVault();
    const { id } = await ctx.params;
    /* ADR-074 — this record must belong to a company this account can
       see; an id alone is no longer proof of that. */
    await assertVaultRowVisible(user, "form", id);
    const { value } = schema.parse(await req.json());
    return Response.json(
      await setVaultArchived("vault_form", id, value, { id: user.id, label: user.name }),
    );
  },
);

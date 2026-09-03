import { handleRoute, requireVault } from "@/lib/auth/guards";
import { assertVaultRowVisible } from "@/lib/services/vault/tenancy";
import { saveVaultTaskResult, vaultResultSchema } from "@/lib/services/vault/tasks";
import { fieldFiles, fieldJson, fieldStr } from "@/lib/services/vault/multipart";

/* ADR-053 — "save for later": adds to the result WITHOUT completing. The gate
   itself lives only in the complete route's service call. */

export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireVault();
    const { id } = await ctx.params;
    /* ADR-074 — this record must belong to a company this account can
       see; an id alone is no longer proof of that. */
    await assertVaultRowVisible(user, "task", id);
    const form = await req.formData();
    /* an EMPTY textarea means "leave the stored text alone" (undefined), never
       "erase it" — the panel is additive; only typed text replaces text */
    const payload = vaultResultSchema.parse({
      resultText: fieldStr(form, "resultText"),
      links: fieldJson(form, "links"),
    });
    const row = await saveVaultTaskResult(id, payload, fieldFiles(form), {
      id: user.id,
      label: user.name,
    });
    return Response.json(row);
  },
);

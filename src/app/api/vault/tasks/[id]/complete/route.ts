import { handleRoute, requireVault } from "@/lib/auth/guards";
import { completeVaultTask, vaultResultSchema } from "@/lib/services/vault/tasks";
import { fieldFiles, fieldJson, fieldStr } from "@/lib/services/vault/multipart";

/* ADR-053 — THE completion route. The service re-checks the RESULT GATE inside
   its transaction (422 with the task still open when unsatisfied), stamps
   server time, and freezes the lateness — whatever the client claimed. */

export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireVault();
    const { id } = await ctx.params;
    const form = await req.formData();
    /* an EMPTY textarea means "leave the stored text alone" (undefined), never
       "erase it" — a result saved earlier must still satisfy the gate here */
    const payload = vaultResultSchema.parse({
      resultText: fieldStr(form, "resultText"),
      links: fieldJson(form, "links"),
    });
    const row = await completeVaultTask(id, payload, fieldFiles(form), {
      id: user.id,
      label: user.name,
    });
    return Response.json(row);
  },
);

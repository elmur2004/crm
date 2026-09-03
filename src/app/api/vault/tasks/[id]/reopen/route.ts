import { handleRoute, requireVault } from "@/lib/auth/guards";
import { assertVaultRowVisible } from "@/lib/services/vault/tenancy";
import { reopenVaultTask } from "@/lib/services/vault/tasks";

/* ADR-053 — reopen a completed task: the result stays, the completion trio is
   cleared, and the erased lateness is logged (provenance). Admin-only wall. */

export const POST = handleRoute(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireVault();
    const { id } = await ctx.params;
    /* ADR-074 — this record must belong to a company this account can
       see; an id alone is no longer proof of that. */
    await assertVaultRowVisible(user, "task", id);
    return Response.json(await reopenVaultTask(id, { id: user.id, label: user.name }));
  },
);

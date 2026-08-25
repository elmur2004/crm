import { handleRoute, requireVault } from "@/lib/auth/guards";
import { reopenVaultTask } from "@/lib/services/vault/tasks";

/* ADR-053 — reopen a completed task: the result stays, the completion trio is
   cleared, and the erased lateness is logged (provenance). Admin-only wall. */

export const POST = handleRoute(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireVault();
    const { id } = await ctx.params;
    return Response.json(await reopenVaultTask(id, { id: user.id, label: user.name }));
  },
);

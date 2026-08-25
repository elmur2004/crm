import { handleRoute, requireVault } from "@/lib/auth/guards";
import { updateVaultTask, vaultTaskSchema } from "@/lib/services/vault/tasks";

/* ADR-053 — edit/reassign. Deadline edits NEVER touch stored lateness (the
   service has no recompute path — that is the invariant, not a gap). */

export const PATCH = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireVault();
    const { id } = await ctx.params;
    const input = vaultTaskSchema.parse(await req.json());
    return Response.json(await updateVaultTask(id, input, { id: user.id, label: user.name }));
  },
);

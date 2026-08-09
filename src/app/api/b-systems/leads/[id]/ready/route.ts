import { handleRoute, requireLeadAccess } from "@/lib/auth/guards";
import { markReadyToClose } from "@/lib/services/leads";

/* V2 §3 — "Mark ready to close": any active stage, any role with lead access;
   flags the card and notifies the admins. */

export const POST = handleRoute(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const { user } = await requireLeadAccess(id);
    const lead = await markReadyToClose("bsystems", id, { id: user.id, label: user.name });
    return Response.json({ ok: true, readyToClose: lead.readyToClose });
  },
);

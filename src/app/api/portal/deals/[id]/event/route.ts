import { handleRoute, requireDealAccess } from "@/lib/auth/guards";
import { applyDealEvent, dealEventSchema } from "@/lib/services/portal-deals";
import type { EngineEvent } from "@/lib/pipeline-engine/types";

/* P-1…P-6 — the role passed to the engine is the caller's REAL role, so a rep's
   Won attempt is rejected server-side inside the engine (P-2), never just in UI. */

export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const { user, isAdmin } = await requireDealAccess(id);
    const input = dealEventSchema.parse(await req.json());
    const result = await applyDealEvent({
      dealId: id,
      event: input.event as EngineEvent,
      group: input.group,
      actor: { id: user.id, label: user.name },
      role: isAdmin ? "portal_admin" : "portal_rep",
    });
    return Response.json(result);
  },
);

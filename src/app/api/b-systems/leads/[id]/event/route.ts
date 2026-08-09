import { handleRoute, requireLeadAccess } from "@/lib/auth/guards";
import { applyLeadEvent, leadEventSchema } from "@/lib/services/leads";
import type { EngineEvent } from "@/lib/pipeline-engine/types";

/* V2 — the caller's REAL role reaches the engine: Won stays admin/sales-only,
   agents get the light auto-return, etc. */

export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const { user, role } = await requireLeadAccess(id);
    const input = leadEventSchema.parse(await req.json());
    const result = await applyLeadEvent({
      brand: "bsystems",
      leadId: id,
      event: input.event as EngineEvent,
      group: input.group,
      actor: { id: user.id, label: user.name },
      role,
    });
    return Response.json(result);
  },
);

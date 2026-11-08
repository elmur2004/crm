import { ApiError, handleRoute, requireLeadAccess } from "@/lib/auth/guards";
import { applyLeadEvent, leadEventSchema } from "@/lib/services/leads";
import type { EngineEvent } from "@/lib/pipeline-engine/types";

/* V2 — the caller's REAL role reaches the engine: Won stays admin/sales-only,
   agents get the light auto-return, etc. */

export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const { user, role, isAdmin } = await requireLeadAccess(id);
    const input = leadEventSchema.parse(await req.json());
    /* founder (2026-11-08) — "Hand this follow-up to" is the admin's alone:
       anybody else who sends an assignee is refused, server-side */
    if (input.assignTo && !isAdmin) {
      throw new ApiError(403, "Only the admin can hand a follow-up to someone");
    }
    const result = await applyLeadEvent({
      brand: "bsystems",
      leadId: id,
      event: input.event as EngineEvent,
      group: input.group,
      actor: { id: user.id, label: user.name },
      role,
      assignTo: input.assignTo,
      canHandOver: isAdmin,
    });
    return Response.json(result);
  },
);

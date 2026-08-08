import { handleRoute, requireBrandStaff } from "@/lib/auth/guards";
import { applyProspectEvent, prospectEventSchema } from "@/lib/services/partners";
import type { EngineEvent } from "@/lib/pipeline-engine/types";

export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBrandStaff("bsystems");
    const { id } = await ctx.params;
    const input = prospectEventSchema.parse(await req.json());
    const result = await applyProspectEvent({
      prospectId: id,
      event: input.event as EngineEvent,
      group: input.group,
      actor: { id: user.id, label: user.name },
      role: "bsystems_staff",
    });
    return Response.json(result);
  },
);

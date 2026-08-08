import { handleRoute, requirePortalAdmin } from "@/lib/auth/guards";
import { defineMilestones, defineMilestonesSchema } from "@/lib/services/milestones";

export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requirePortalAdmin();
    const { id } = await ctx.params;
    const input = defineMilestonesSchema.parse(await req.json());
    const result = await defineMilestones(id, input, { id: user.id, label: user.name });
    return Response.json(result, { status: 201 }); // { warning } — A-11 non-blocking
  },
);

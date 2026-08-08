import { handleRoute, requirePortalAdmin } from "@/lib/auth/guards";
import { updateWonDealValues, wonDealValuesSchema } from "@/lib/services/milestones";

export const PATCH = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requirePortalAdmin();
    const { id } = await ctx.params;
    const input = wonDealValuesSchema.parse(await req.json());
    const wonDeal = await updateWonDealValues(id, input, { id: user.id, label: user.name });
    return Response.json(wonDeal);
  },
);

import { handleRoute, requireDealAccess } from "@/lib/auth/guards";
import { updateDeal, updateDealSchema } from "@/lib/services/portal-deals";

export const PATCH = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const { user } = await requireDealAccess(id); // owner-or-admin (§3)
    const input = updateDealSchema.parse(await req.json());
    const deal = await updateDeal(id, input, { id: user.id, label: user.name });
    return Response.json(deal);
  },
);

import { handleRoute, requireRole } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { createDeal, createDealSchema } from "@/lib/services/portal-deals";

export const POST = handleRoute(async (req: Request) => {
  const user = await requireRole("portal_rep", "portal_admin");
  if (!user.portalRepId) {
    throw new ApiError(400, "Only reps with a portal profile can create deals");
  }
  const input = createDealSchema.parse(await req.json());
  const deal = await createDeal(user.portalRepId, input, { id: user.id, label: user.name });
  return Response.json(deal, { status: 201 });
});

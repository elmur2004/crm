import { handleRoute, requireRole } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { repWonDeals } from "@/lib/services/won-deals";

/* §8.3 — the rep's read-only Won Deals with SERVER-REDACTED locked milestone
   values. Also the polling target for the ≤5s milestone-unlock refresh (ADR-009). */

export const GET = handleRoute(async () => {
  const user = await requireRole("portal_rep", "portal_admin");
  if (!user.portalRepId) throw new ApiError(400, "No portal profile on this account");
  const wonDeals = await repWonDeals(user.portalRepId);
  return Response.json(wonDeals);
});

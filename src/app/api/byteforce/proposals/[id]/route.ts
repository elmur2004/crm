import { handleRoute, requireLeadAccess } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { db } from "@/lib/db";

/* ADR-078 — correct a proposal's service and amount. THE ADMIN ONLY (the
   founder's answer when asked): this number drives the pipeline figure, the Won
   gate's prefill and, through the Won deal, an agent's commission.

   On ByteForce that has always meant NOBODY ("nobody on ByteForce, which has no
   admin role at all" — services/proposals.ts), and it STILL means nobody. Since
   the founder's "assigned leads only" (2026-11-08) `requireLeadAccess` reports
   the ByteForce ADMIN (the platform admin) as `isAdmin`, which would quietly
   have handed him this edit; ADR-078 never granted it and nothing asked for it,
   so the refusal is stated here rather than inherited from that flag. Widening
   it is a founder decision (flagged), and the B-Systems twin is unchanged.

   The BRAND comes from the ROUTE, and `requireLeadAccess` still runs first — so
   a proposal of a lead the caller cannot open is refused exactly as before. */

export const PATCH = handleRoute(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const proposal = await db.proposal.findUnique({
      where: { id },
      select: { leadId: true },
    });
    if (!proposal?.leadId) throw new ApiError(404, "Proposal not found");
    await requireLeadAccess(proposal.leadId);
    throw new ApiError(403, "Only the admin can edit a proposal");
  },
);

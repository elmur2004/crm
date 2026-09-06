import { handleRoute, requireLeadAccess } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { proposalEditSchema, updateProposal } from "@/lib/services/proposals";

/* ADR-078 — correct a proposal's service and amount. THE ADMIN ONLY (the
   founder's answer when asked): this number drives the pipeline figure, the Won
   gate's prefill and, through the Won deal, an agent's commission.

   The BRAND comes from the ROUTE, as it does everywhere in these namespaces,
   and `requireLeadAccess` re-checks the lead itself — so a proposal of another
   company 404s in the service and an account without access to this lead is
   refused before that. */

export const PATCH = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const proposal = await db.proposal.findUnique({
      where: { id },
      select: { leadId: true },
    });
    if (!proposal?.leadId) throw new ApiError(404, "Proposal not found");
    const { user, isAdmin } = await requireLeadAccess(proposal.leadId);
    if (!isAdmin) throw new ApiError(403, "Only the admin can edit a proposal");
    const input = proposalEditSchema.parse(await req.json());
    await updateProposal(id, "byteforce", input, { id: user.id, label: user.name });
    return Response.json({ ok: true });
  },
);

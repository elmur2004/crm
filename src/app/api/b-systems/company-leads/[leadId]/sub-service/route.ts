import { handleRoute, requireRole } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import {
  clearSubService,
  setSubService,
  subServiceSchema,
} from "@/lib/services/foreign-sub-service";

/* ADR-077 — the platform administrator annotates a MINDOO proposal with what
   ByteForce delivers inside it.

   THE GUARD IS THE ROLE, not the brand. Every other route in this namespace
   derives its company from the path, and deliberately so; this one acts on a
   Mindoo record from a B-Systems admin's screen, which is exactly the crossing
   ADR-074 forbids in general and the founder asked for here in particular:
   "the admin and the admin only is allowed to customize the proposal that is
   appearing in the ByteForce CRM."

   So the crossing is named rather than implied — `bsystems_admin`, the one
   account that holds every company — and the SERVICE proves the proposal is
   Mindoo's before it writes anything. `requireBrandStaff` would have been the
   wrong tool: it would admit Mindoo's own staff, who the founder said must see
   only their own number and service. */

/** The lead's newest proposal — the one the board and the card both show. */
async function latestProposalOf(leadId: string) {
  const proposal = await db.proposal.findFirst({
    where: { leadId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!proposal) throw new ApiError(404, "This lead has no proposal yet");
  return proposal;
}

export const PUT = handleRoute(
  async (req: Request, ctx: { params: Promise<{ leadId: string }> }) => {
    const user = await requireRole("bsystems_admin");
    const { leadId } = await ctx.params;
    const input = subServiceSchema.parse(await req.json());
    const proposal = await latestProposalOf(leadId);
    await setSubService(proposal.id, input, { id: user.id, label: user.name });
    return Response.json({ ok: true });
  },
);

export const DELETE = handleRoute(
  async (_req: Request, ctx: { params: Promise<{ leadId: string }> }) => {
    const user = await requireRole("bsystems_admin");
    const { leadId } = await ctx.params;
    const proposal = await latestProposalOf(leadId);
    await clearSubService(proposal.id, { id: user.id, label: user.name });
    return Response.json({ ok: true });
  },
);

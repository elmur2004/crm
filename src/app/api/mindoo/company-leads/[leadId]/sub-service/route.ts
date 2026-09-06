import { handleRoute, requireRole } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import {
  clearSubService,
  setSubService,
  subServiceSchema,
} from "@/lib/services/foreign-sub-service";

/* ADR-078 — the MINDOO-side twin of the sub-service endpoint.

   Founder: "when we are sending proposals through the Mindoo platform, the
   admin… is allowed to customize the proposal that is appearing in the ByteForce
   CRM" — and, asked where he expected to find it, "both places". So it is
   settable while the proposal is being sent from Mindoo, and from the purple
   card in the ByteForce CRM afterwards. One service, two doors.

   THE HONEST CONSEQUENCE, and he was told it before choosing: on this side the
   only accounts that exist are `mindoo_staff`, and Mindoo has no admin/non-admin
   distinction — its one role IS its whole staff (ADR-073). So every Mindoo
   teammate can set and see the ByteForce line here. Today that is one account,
   his own; the moment he adds a second from /mindoo/users, that person sees it
   too, which cuts against the original "everyone else will just get the number
   and the service of Mindoo". Flagged in PROGRESS rather than solved by
   inventing a second Mindoo role nobody asked for.

   The SERVICE is unchanged and still proves the proposal is Mindoo's, so this
   route cannot reach another company's record however it is called. */

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
    const user = await requireRole("mindoo_staff");
    const { leadId } = await ctx.params;
    const input = subServiceSchema.parse(await req.json());
    const proposal = await latestProposalOf(leadId);
    await setSubService(proposal.id, input, { id: user.id, label: user.name });
    return Response.json({ ok: true });
  },
);

export const DELETE = handleRoute(
  async (_req: Request, ctx: { params: Promise<{ leadId: string }> }) => {
    const user = await requireRole("mindoo_staff");
    const { leadId } = await ctx.params;
    const proposal = await latestProposalOf(leadId);
    await clearSubService(proposal.id, { id: user.id, label: user.name });
    return Response.json({ ok: true });
  },
);

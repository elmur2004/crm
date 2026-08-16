import { z } from "zod";
import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { assignLeadOwner } from "@/lib/services/leads";

/* Founder — "assign it to one of my partners or one of my agents who will be
   responsible for that lead". ADMIN ONLY: handing a lead to someone else is a
   management act, so the wall is requireBsAdmin, not requireLeadAccess (an
   agent must never be able to push their own lead onto a colleague, nor pull
   one to themselves). assignLeadOwner re-checks the lead's brand and refuses
   archived leads and non-assignable roles. */
export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBsAdmin();
    const { id } = await ctx.params;
    const { userId } = z.object({ userId: z.string().min(1) }).parse(await req.json());
    const lead = await assignLeadOwner(id, userId, { id: user.id, label: user.name });
    return Response.json({ ok: true, ownerUserId: lead.ownerUserId, ownerType: lead.ownerType });
  },
);

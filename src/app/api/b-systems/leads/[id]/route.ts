import { handleRoute, isDataEntry, requireLeadAccess, requireUser } from "@/lib/auth/guards";
import { deleteLead, updateLead, updateLeadSchema } from "@/lib/services/leads";
import { assertCanCorrect } from "@/lib/services/data-entry";
import { ApiError } from "@/lib/api-error";

/* ADR-051: requireLeadAccess refuses a data-entry user outright — they cannot
   READ other people's leads, which is the point. The one exception is a lead
   THEY entered that nobody has picked up: correcting a typo a minute later is
   the same act as typing it. That check never widens beyond their own rows. */
export const PATCH = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const me = await requireUser();
    if (isDataEntry(me)) {
      await assertCanCorrect(me, { kind: "lead", id });
      const input = updateLeadSchema.parse(await req.json());
      const lead = await updateLead("bsystems", id, input, { id: me.id, label: me.name });
      return Response.json(lead);
    }
    const { user } = await requireLeadAccess(id);
    const input = updateLeadSchema.parse(await req.json());
    const lead = await updateLead("bsystems", id, input, { id: user.id, label: user.name });
    return Response.json(lead);
  },
);

/* V2 §2.2 — delete is ADMIN only. */
export const DELETE = handleRoute(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const { user, isAdmin } = await requireLeadAccess(id);
    if (!isAdmin) throw new ApiError(403, "Only the admin can delete a lead");
    await deleteLead("bsystems", id, { id: user.id, label: user.name });
    return Response.json({ ok: true });
  },
);

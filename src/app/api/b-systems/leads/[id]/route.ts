import { handleRoute, requireLeadAccess } from "@/lib/auth/guards";
import { deleteLead, updateLead, updateLeadSchema } from "@/lib/services/leads";
import { ApiError } from "@/lib/api-error";

export const PATCH = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
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

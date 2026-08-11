import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { deletePartner, updatePartner, updatePartnerSchema } from "@/lib/services/partners";

/* founder V4 — the admin edits and deletes directory partners. */

export const PATCH = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBsAdmin();
    const { id } = await ctx.params;
    const input = updatePartnerSchema.parse(await req.json());
    const partner = await updatePartner(id, input, { id: user.id, label: user.name });
    return Response.json(partner);
  },
);

export const DELETE = handleRoute(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBsAdmin();
    const { id } = await ctx.params;
    await deletePartner(id, { id: user.id, label: user.name });
    return Response.json({ ok: true });
  },
);

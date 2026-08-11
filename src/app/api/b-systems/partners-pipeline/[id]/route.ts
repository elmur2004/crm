import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { deleteProspect, updateProspect, updateProspectSchema } from "@/lib/services/partners";

export const PATCH = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBsAdmin();
    const { id } = await ctx.params;
    const input = updateProspectSchema.parse(await req.json());
    const prospect = await updateProspect(id, input, { id: user.id, label: user.name });
    return Response.json(prospect);
  },
);

/* founder V4 — the admin deletes a pipeline card (cascades records + files;
   a converted card also removes its directory Partner, leads keep living). */
export const DELETE = handleRoute(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBsAdmin();
    const { id } = await ctx.params;
    await deleteProspect(id, { id: user.id, label: user.name });
    return Response.json({ ok: true });
  },
);

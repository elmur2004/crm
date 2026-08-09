import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { updateProspect, updateProspectSchema } from "@/lib/services/partners";

export const PATCH = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBsAdmin();
    const { id } = await ctx.params;
    const input = updateProspectSchema.parse(await req.json());
    const prospect = await updateProspect(id, input, { id: user.id, label: user.name });
    return Response.json(prospect);
  },
);

import { handleRoute, requireBrandStaff } from "@/lib/auth/guards";
import { updateProspect, updateProspectSchema } from "@/lib/services/partners";

export const PATCH = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBrandStaff("bsystems");
    const { id } = await ctx.params;
    const input = updateProspectSchema.parse(await req.json());
    const prospect = await updateProspect(
      id,
      input,
      { id: user.id, label: user.name },
      "bsystems_staff",
    );
    return Response.json(prospect);
  },
);

import { z } from "zod";
import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { setUserActive } from "@/lib/services/users";

const bodySchema = z.object({ active: z.boolean() });

/* V2 §2.10 — deactivate/reactivate (the "delete" affordance, reversible). */
export const PATCH = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBsAdmin();
    const { id } = await ctx.params;
    const { active } = bodySchema.parse(await req.json());
    await setUserActive(id, active, { id: user.id, label: user.name });
    return Response.json({ ok: true });
  },
);

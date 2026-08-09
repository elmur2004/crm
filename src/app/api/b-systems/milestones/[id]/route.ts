import { z } from "zod";
import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { checkMilestone, uncheckMilestone } from "@/lib/services/milestones";

const bodySchema = z.object({ completed: z.boolean() });

/* V2 §4/§7 — milestone check/uncheck, ADMIN ONLY. */
export const PATCH = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBsAdmin();
    const { id } = await ctx.params;
    const { completed } = bodySchema.parse(await req.json());
    if (completed) await checkMilestone(id, { id: user.id, label: user.name });
    else await uncheckMilestone(id, { id: user.id, label: user.name });
    return Response.json({ ok: true });
  },
);

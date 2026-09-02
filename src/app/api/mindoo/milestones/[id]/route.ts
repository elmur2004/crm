import { z } from "zod";
import { handleRoute, requireBrandStaff } from "@/lib/auth/guards";
import { checkMilestone, uncheckMilestone } from "@/lib/services/milestones";

const bodySchema = z.object({ completed: z.boolean() });

/* ADR-073 — Mindoo wins the same way B-Systems does, so it has Won Deals and
   therefore milestones. Its single staff role is the company's administrator,
   which is who the B-Systems twin reserves this for.

   The COMPANY is passed to the service, which refuses a milestone belonging to
   any other one with a 404. That wall is new (see services/milestones.ts): with
   one company an id was proof enough, with three it is proof of nothing. */
export const PATCH = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBrandStaff("mindoo");
    const { id } = await ctx.params;
    const { completed } = bodySchema.parse(await req.json());
    if (completed) await checkMilestone(id, "mindoo", { id: user.id, label: user.name });
    else await uncheckMilestone(id, "mindoo", { id: user.id, label: user.name });
    return Response.json({ ok: true });
  },
);

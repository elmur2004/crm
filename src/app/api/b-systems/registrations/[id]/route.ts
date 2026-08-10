import { z } from "zod";
import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { approveRegistration, rejectRegistration } from "@/lib/services/users";

const bodySchema = z.object({ action: z.enum(["approve", "reject"]) });

/* Founder: agent self-signup is a REQUEST — the admin approves or declines it
   on the Registrations page. */
export const PATCH = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBsAdmin();
    const { id } = await ctx.params;
    const { action } = bodySchema.parse(await req.json());
    const actor = { id: user.id, label: user.name };
    if (action === "approve") await approveRegistration(id, actor);
    else await rejectRegistration(id, actor);
    return Response.json({ ok: true });
  },
);

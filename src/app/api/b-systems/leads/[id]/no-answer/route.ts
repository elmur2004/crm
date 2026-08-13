import { z } from "zod";
import { handleRoute, requireLeadAccess } from "@/lib/auth/guards";
import { setNoAnswer } from "@/lib/services/leads";

/* Founder directive (ADR-039) — the "didn't answer" card marker: any role with
   lead access can toggle it, same wall as /ready; a flag, never a stage move. */
export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const { user } = await requireLeadAccess(id);
    const { value } = z.object({ value: z.boolean() }).parse(await req.json());
    const lead = await setNoAnswer("bsystems", id, value, { id: user.id, label: user.name });
    return Response.json({ ok: true, noAnswer: lead.noAnswer });
  },
);

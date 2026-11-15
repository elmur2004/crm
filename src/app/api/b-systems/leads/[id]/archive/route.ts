import { z } from "zod";
import { handleRoute, requireLeadAccess } from "@/lib/auth/guards";
import { setArchived } from "@/lib/services/leads";

/* Founder (ADR-043) — archive/unarchive a lead: requireLeadAccess, the
   lead-scope wall (admin any / everyone else their own leads only). */
export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const { user } = await requireLeadAccess(id);
    const { value } = z.object({ value: z.boolean() }).parse(await req.json());
    const lead = await setArchived("bsystems", id, value, { id: user.id, label: user.name });
    return Response.json({ ok: true, archived: lead.archived });
  },
);

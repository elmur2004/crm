import { z } from "zod";
import { handleRoute, requireBrandStaff } from "@/lib/auth/guards";
import { setArchived } from "@/lib/services/leads";

/* ADR-043 / ADR-073 — archive or unarchive a MINDOO lead. The brand is the
   route's, and `setArchived` looks the lead up brand-scoped, so a B-Systems id
   posted through this door is a 404 rather than a cross-company write. */
export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const user = await requireBrandStaff("mindoo");
    const { value } = z.object({ value: z.boolean() }).parse(await req.json());
    const lead = await setArchived("mindoo", id, value, { id: user.id, label: user.name });
    return Response.json({ ok: true, archived: lead.archived });
  },
);

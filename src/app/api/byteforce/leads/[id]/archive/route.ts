import { z } from "zod";
import { handleRoute, requireBrandStaff } from "@/lib/auth/guards";
import { setArchived } from "@/lib/services/leads";

/* Founder (ADR-043) — archive/unarchive a ByteForce lead (brand staff). */
export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const user = await requireBrandStaff("byteforce");
    const { value } = z.object({ value: z.boolean() }).parse(await req.json());
    const lead = await setArchived("byteforce", id, value, { id: user.id, label: user.name });
    return Response.json({ ok: true, archived: lead.archived });
  },
);

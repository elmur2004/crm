import { z } from "zod";
import { handleRoute, requireBrandLeadAccess } from "@/lib/auth/guards";
import { setArchived } from "@/lib/services/leads";

/* Founder (ADR-043) — archive/unarchive a ByteForce lead (brand staff). */
export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    /* founder (2026-11-08) — a non-admin works only the leads he owns: the
       namespace's staff wall, the brand (404), then the lead's own (403) */
    const { user } = await requireBrandLeadAccess("byteforce", id);
    const { value } = z.object({ value: z.boolean() }).parse(await req.json());
    const lead = await setArchived("byteforce", id, value, { id: user.id, label: user.name });
    return Response.json({ ok: true, archived: lead.archived });
  },
);

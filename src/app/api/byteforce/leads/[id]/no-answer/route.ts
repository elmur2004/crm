import { z } from "zod";
import { handleRoute, requireBrandStaff } from "@/lib/auth/guards";
import { setNoAnswer } from "@/lib/services/leads";

/* Founder (ADR-042 board-parity round) — the "didn't answer" marker on the
   ByteForce board: any staff member of the brand can toggle it (the brand wall
   lives in the guard + the service's brand-scoped lookup). */
export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const user = await requireBrandStaff("byteforce");
    const { value } = z.object({ value: z.boolean() }).parse(await req.json());
    const lead = await setNoAnswer("byteforce", id, value, { id: user.id, label: user.name });
    return Response.json({ ok: true, noAnswer: lead.noAnswer });
  },
);

import { z } from "zod";
import { handleRoute, requireBrandStaff } from "@/lib/auth/guards";
import { setNoAnswer } from "@/lib/services/leads";

/* ADR-064 / ADR-073 — the "didn't answer" tally on Mindoo's board. Mindoo has
   one staff role and every member of it sees every card, so `requireBrandStaff`
   is the whole test — the ByteForce precedent. `true` counts one more attempt,
   `false` is the Answered press that resets it. */
export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const user = await requireBrandStaff("mindoo");
    const { value } = z.object({ value: z.boolean() }).parse(await req.json());
    const lead = await setNoAnswer("mindoo", id, value, { id: user.id, label: user.name });
    return Response.json({ ok: true, noAnswer: lead.noAnswer, noAnswerCount: lead.noAnswerCount });
  },
);

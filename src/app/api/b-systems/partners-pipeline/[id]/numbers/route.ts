import { z } from "zod";
import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { addAlternativeNumbers } from "@/lib/services/partners";

const bodySchema = z.object({ numbers: z.array(z.string().min(1).max(50)).min(1).max(20) });

/* V2 §6 — add alternative number(s); from Didn't Answer this auto-returns the
   card to Lead (PP-2). */
export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBsAdmin();
    const { id } = await ctx.params;
    const { numbers } = bodySchema.parse(await req.json());
    const prospect = await addAlternativeNumbers(
      id,
      numbers,
      { id: user.id, label: user.name },
      "bsystems_admin",
    );
    return Response.json(prospect);
  },
);

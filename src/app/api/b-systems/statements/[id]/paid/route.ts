import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { markStatementPaid } from "@/lib/services/statements";

/* V2 §7 — Mark payment: a proof IMAGE upload flips the statement to paid. */

export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBsAdmin();
    const { id } = await ctx.params;
    const form = await req.formData();
    const proof = form.get("proof");
    if (!(proof instanceof File)) throw new ApiError(400, "A payment proof image is required");
    const statement = await markStatementPaid(id, proof, { id: user.id, label: user.name });
    return Response.json(statement);
  },
);

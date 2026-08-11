import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { markStatementPaid, replaceStatementProof } from "@/lib/services/statements";

/* V2 §7 — Mark payment: a proof IMAGE upload flips the statement to paid.
   PUT replaces the proof on an already-paid statement (lost/wrong file). */

async function proofFrom(req: Request): Promise<File> {
  const form = await req.formData();
  const proof = form.get("proof");
  if (!(proof instanceof File)) throw new ApiError(400, "A payment proof image is required");
  return proof;
}

export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBsAdmin();
    const { id } = await ctx.params;
    const statement = await markStatementPaid(id, await proofFrom(req), {
      id: user.id,
      label: user.name,
    });
    return Response.json(statement);
  },
);

export const PUT = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBsAdmin();
    const { id } = await ctx.params;
    const statement = await replaceStatementProof(id, await proofFrom(req), {
      id: user.id,
      label: user.name,
    });
    return Response.json(statement);
  },
);

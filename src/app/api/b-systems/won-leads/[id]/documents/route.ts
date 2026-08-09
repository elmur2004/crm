import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { addWonDocument } from "@/lib/services/won-leads";

/* V2 §5 — proposal / contract PDF uploads on a won lead (admin only). */

export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBsAdmin();
    const { id } = await ctx.params;
    const form = await req.formData();
    const file = form.get("file");
    const kind = String(form.get("kind") ?? "");
    if (!(file instanceof File)) throw new ApiError(400, "No file provided");
    if (kind !== "proposal" && kind !== "contract") throw new ApiError(400, "Bad document kind");
    const attachment = await addWonDocument(id, kind, file, { id: user.id, label: user.name });
    return Response.json(attachment, { status: 201 });
  },
);

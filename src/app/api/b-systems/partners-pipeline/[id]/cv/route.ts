import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { setProspectCv } from "@/lib/services/partners";

/* Founder: an AGENT card carries the same CV a self-applied agent uploads. It
   can arrive with the card or later — at the Won gate it moves onto the created
   agent's profile, so the two routes into the system end up identical. */

export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBsAdmin();
    const { id } = await ctx.params;
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "No file provided");
    const attachment = await setProspectCv(id, file, { id: user.id, label: user.name });
    return Response.json(attachment, { status: 201 });
  },
);

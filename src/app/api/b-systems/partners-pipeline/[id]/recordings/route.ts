import { handleRoute, requireBrandStaff } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { addRecording } from "@/lib/services/partners";

export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBrandStaff("bsystems");
    const { id } = await ctx.params;
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "No file provided");
    const attachment = await addRecording(id, file, { id: user.id, label: user.name });
    return Response.json(attachment, { status: 201 });
  },
);

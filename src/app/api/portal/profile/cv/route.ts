import { handleRoute, requireRole } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { replaceCv } from "@/lib/services/portal-reps";

export const POST = handleRoute(async (req: Request) => {
  const user = await requireRole("portal_rep", "portal_admin");
  const form = await req.formData();
  const cv = form.get("cv");
  if (!(cv instanceof File)) throw new ApiError(400, "CV file is required");
  await replaceCv(user.id, cv, { id: user.id, label: user.name });
  return Response.json({ ok: true });
});

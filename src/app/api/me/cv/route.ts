import { handleRoute, requireRole } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { selfActor } from "@/lib/services/my-account";
import { replaceCv } from "@/lib/services/portal-reps";

/* ADR-103 — an agent replaces his own CV from My account (was
   /api/b-systems/profile/cv). A CV is an agent's alone, so the wall is the
   agent role, exactly as before. */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireRole("bsystems_agent");
  const form = await req.formData();
  const cv = form.get("cv");
  if (!(cv instanceof File)) throw new ApiError(400, "No CV file provided");
  await replaceCv(user.id, cv, await selfActor(user));
  return Response.json({ ok: true });
});

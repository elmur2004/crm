import { handleRoute, requireRole } from "@/lib/auth/guards";
import { updateRepProfile, updateProfileSchema } from "@/lib/services/portal-reps";

export const PATCH = handleRoute(async (req: Request) => {
  const user = await requireRole("portal_rep", "portal_admin");
  const input = updateProfileSchema.parse(await req.json());
  const profile = await updateRepProfile(user.id, input, { id: user.id, label: user.name });
  return Response.json(profile);
});

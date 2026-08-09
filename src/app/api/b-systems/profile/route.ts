import { handleRoute, requireRole } from "@/lib/auth/guards";
import { updateProfileSchema, updateRepProfile } from "@/lib/services/portal-reps";

/* V2 — agent profile basics (the ex-portal §8.4 flow, now under /b-systems). */

export const PATCH = handleRoute(async (req: Request) => {
  const user = await requireRole("bsystems_agent");
  const input = updateProfileSchema.parse(await req.json());
  const updated = await updateRepProfile(user.id, input, { id: user.id, label: user.name });
  return Response.json(updated);
});

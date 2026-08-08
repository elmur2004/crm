import { handleRoute, requireRole } from "@/lib/auth/guards";
import { changePassword, changePasswordSchema } from "@/lib/services/portal-reps";

export const POST = handleRoute(async (req: Request) => {
  const user = await requireRole("portal_rep", "portal_admin");
  const input = changePasswordSchema.parse(await req.json());
  await changePassword(user.id, input);
  return Response.json({ ok: true });
});

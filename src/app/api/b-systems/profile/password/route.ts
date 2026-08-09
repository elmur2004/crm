import { handleRoute, requireRole } from "@/lib/auth/guards";
import { changePassword, changePasswordSchema } from "@/lib/services/portal-reps";

/* V2 — password change for agents AND partners (partners land with the
   auto-generated "{CompanyName}@Bsystemspartnership" password). */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireRole("bsystems_agent", "bsystems_partner");
  const input = changePasswordSchema.parse(await req.json());
  await changePassword(user.id, input);
  return Response.json({ ok: true });
});

import { handleRoute, requireUser } from "@/lib/auth/guards";
import { changeMyPassword, myPasswordSchema, selfActor } from "@/lib/services/my-account";

/* ADR-103 — every account changes its OWN password, with the current one.
   (Was agents and partners only, at /api/b-systems/profile/password.) */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireUser();
  const input = myPasswordSchema.parse(await req.json());
  await changeMyPassword(user.id, input, await selfActor(user));
  return Response.json({ ok: true });
});

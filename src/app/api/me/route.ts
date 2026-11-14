import { handleRoute, requireUser } from "@/lib/auth/guards";
import { myAccountSchema, selfActor, updateMyAccount } from "@/lib/services/my-account";

/* ADR-103 — My account: ANY live account edits its OWN details (name, email,
   phone; an agent's profile basics). The id is the session's, never the
   request's — there is no way to name somebody else here — and the schema has
   no roles, flags or status to send. Everything else about an account is the
   admin's, at /api/b-systems/users behind requireBsAdmin. */

export const PATCH = handleRoute(async (req: Request) => {
  const user = await requireUser();
  const input = myAccountSchema.parse(await req.json());
  /* the History names the admin when he is acting as this person */
  await updateMyAccount(user.id, input, await selfActor(user));
  return Response.json({ ok: true });
});

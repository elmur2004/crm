import { z } from "zod";
import { handleRoute, requireUser } from "@/lib/auth/guards";
import { removeSubscription } from "@/lib/services/push/subscriptions";

/* ADR-065 — "stop notifying me on this device".

   Scoped to the caller's own rows by construction: the endpoint comes from the
   body but the user id comes from the session, and the delete matches BOTH.
   Somebody else's endpoint deletes nothing and says so with the same `ok: true`
   — the `markNotificationRead` convention: a foreign id is a silent no-op, so
   the endpoint can never be used to probe whether a device exists. */

const bodySchema = z.object({ endpoint: z.string().trim().min(1).max(2000) });

export const POST = handleRoute(async (req: Request) => {
  const user = await requireUser();
  const { endpoint } = bodySchema.parse(await req.json());
  await removeSubscription(user.id, endpoint);
  return Response.json({ ok: true });
});

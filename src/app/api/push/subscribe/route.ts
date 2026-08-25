import { ApiError, handleRoute, requireUser } from "@/lib/auth/guards";
import { pushSubscriptionSchema, saveSubscription } from "@/lib/services/push/subscriptions";

/* ADR-065 — "notify me on THIS device".

   Any signed-in account may register a device, and only ever its OWN: the user
   id comes from the session, never from the body, so there is no shape of
   request that registers a device against somebody else.

   IMPERSONATION IS REFUSED. `requireUser()` returns the person being acted AS,
   so an admin who pressed this while impersonating would attach their own phone
   to that person's account and start receiving that person's notifications —
   a real leak, and the only one this route could produce. Turn notifications on
   from your own session.

   No feature-flag check: this is a device registry, and a browser cannot even
   produce a subscription without an applicationServerKey, which it only has
   when the keys ARE configured. One less branch to get wrong. */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireUser();
  if (user.impersonatorId) {
    throw new ApiError(403, "Turn notifications on from your own account, not while acting as someone else");
  }
  const input = pushSubscriptionSchema.parse(await req.json());
  await saveSubscription(user.id, input, req.headers.get("user-agent"));
  return Response.json({ ok: true });
});

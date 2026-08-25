import { handleRoute, requireUser } from "@/lib/auth/guards";
import { publicVapidKey } from "@/lib/services/push/config";

/* ADR-065 — the browser's half of the VAPID pair, read at RUNTIME.

   Deliberately a route and NOT a `NEXT_PUBLIC_` variable: that would be inlined
   into the client bundle when the container builds, and the container builds
   BEFORE anyone can set anything on the host — the key would be baked as empty
   for ever and only a fresh build could ever change it. Read per request, so
   the founder sets two variables, restarts, and it is live.

   `key: null` is the "not configured" answer and the enable control simply does
   not render — the app then looks exactly as it does today. It is also the
   answer while an admin is IMPERSONATING somebody: a device registered in that
   session would belong to the person being acted as, so the offer is withheld
   here and refused again in the subscribe route, which is the real wall.

   Brand-agnostic and session-gated, the /api/undo precedent. The value is
   public by definition (every subscribed browser holds it); the gate is house
   style, not secrecy. */

export const dynamic = "force-dynamic";

export const GET = handleRoute(async () => {
  const user = await requireUser();
  const key = user.impersonatorId ? null : publicVapidKey();
  return Response.json({ key }, { headers: { "Cache-Control": "no-store" } });
});

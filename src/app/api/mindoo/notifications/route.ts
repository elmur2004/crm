import { handleRoute, requireRole } from "@/lib/auth/guards";
import { listNotifications } from "@/lib/services/notifications";

/* ADR-073 — Mindoo's bell feed: own rows only. `isAdmin: false` is not a
   demotion — it selects the PERSONAL feed rather than the admin broadcast one,
   which is B-Systems chrome (the ByteForce precedent, verbatim). */
export const GET = handleRoute(async () => {
  const user = await requireRole("mindoo_staff");
  const items = await listNotifications({ isAdmin: false, userId: user.id });
  return Response.json(items);
});

import { handleRoute, requireRole } from "@/lib/auth/guards";
import { listNotifications } from "@/lib/services/notifications";

/* ByteForce bell feed — own rows only (admin broadcasts are B-Systems chrome). */

export const GET = handleRoute(async () => {
  const user = await requireRole("byteforce_staff");
  const items = await listNotifications({ isAdmin: false, userId: user.id });
  return Response.json(items);
});

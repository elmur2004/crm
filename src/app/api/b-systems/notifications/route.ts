import { handleRoute, requireRole } from "@/lib/auth/guards";
import { listNotifications } from "@/lib/services/notifications";

/* V2 §10 — the nav bell's polling target. */

export const GET = handleRoute(async () => {
  const user = await requireRole(
    "bsystems_admin",
    "bsystems_sales",
    "bsystems_agent",
    "bsystems_partner",
  );
  const items = await listNotifications({
    isAdmin: user.roles.includes("bsystems_admin"),
    userId: user.id,
  });
  return Response.json(items);
});

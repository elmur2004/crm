import { handleRoute, requireRole } from "@/lib/auth/guards";
import { markNotificationRead } from "@/lib/services/notifications";

export const PATCH = handleRoute(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    await requireRole("bsystems_admin", "bsystems_sales", "bsystems_agent", "bsystems_partner");
    const { id } = await ctx.params;
    await markNotificationRead(id);
    return Response.json({ ok: true });
  },
);

import { handleRoute, requireRole } from "@/lib/auth/guards";
import { markNotificationRead } from "@/lib/services/notifications";

export const PATCH = handleRoute(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireRole("mindoo_staff");
    const { id } = await ctx.params;
    await markNotificationRead(id, { userId: user.id, isAdmin: false });
    return Response.json({ ok: true });
  },
);

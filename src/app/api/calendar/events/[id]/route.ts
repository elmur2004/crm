import { handleRoute, requireRole } from "@/lib/auth/guards";
import { CALENDAR_ROLES } from "@/lib/services/calendar";
import {
  calendarEventSchema,
  deleteCalendarEvent,
  updateCalendarEvent,
} from "@/lib/services/calendar-events";

/* ADR-071 — edit or remove one of MY entries.

   Both verbs pass the session's own id to the service, which re-reads the row
   and refuses anything it does not own — with 404, not 403, so an enumerating
   caller cannot learn which ids are real. There is no admin override on either:
   an admin may see that a colleague is busy, which is the calendar's entire
   job, but may not rewrite or delete somebody's private time. */

export const PATCH = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireRole(...CALENDAR_ROLES);
    const { id } = await ctx.params;
    const input = calendarEventSchema.parse(await req.json());
    return Response.json(await updateCalendarEvent(id, input, user.id));
  },
);

export const DELETE = handleRoute(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireRole(...CALENDAR_ROLES);
    const { id } = await ctx.params;
    await deleteCalendarEvent(id, user.id);
    return new Response(null, { status: 204 });
  },
);

import { handleRoute, requireRole } from "@/lib/auth/guards";
import { CALENDAR_ROLES } from "@/lib/services/calendar";
import { attendeesSchema, setMeetingAttendees } from "@/lib/services/meeting-attendees";

/* ADR-071 — say who else a CRM meeting occupies ("Also blocks").

   Authenticate FIRST, then resolve the meeting inside the service, which puts
   it behind `requireLeadAccess` — the review hardening the To-Do's done routes
   already established: an anonymous POST is refused before any database work
   and can never tell a real meeting id from a made-up one. */

export const PUT = handleRoute(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireRole(...CALENDAR_ROLES);
  const { id } = await ctx.params;
  const input = attendeesSchema.parse(await req.json());
  return Response.json({ attendees: await setMeetingAttendees(id, input, user) });
});

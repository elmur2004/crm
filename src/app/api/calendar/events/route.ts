import { handleRoute, requireRole } from "@/lib/auth/guards";
import { CALENDAR_ROLES } from "@/lib/services/calendar";
import { calendarEventSchema, createCalendarEvent } from "@/lib/services/calendar-events";

/* ADR-071 — a person's OWN calendar entry.

   Its own namespace, not /api/b-systems or /api/byteforce, and that is a
   decision rather than an oversight. Those two namespaces exist to refuse a
   caller from the other company (the wall is the ROUTE, never a parameter) —
   but a personal entry has no company: it is one account's own time, and the
   same hour cannot be free under one label and busy under the other. A
   company-namespaced endpoint would have forced an answer to a question this
   record does not ask.

   Nothing widens: the role list is the page's own `CALENDAR_ROLES`, so the
   data-entry account ADR-051 gave one destination cannot reach this either,
   and the OWNER is taken from the session inside the service — there is no
   `userId` on the wire for a caller to set. */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireRole(...CALENDAR_ROLES);
  const input = calendarEventSchema.parse(await req.json());
  const row = await createCalendarEvent(input, user.id);
  return Response.json(row, { status: 201 });
});

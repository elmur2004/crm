import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import type { CurrentUser } from "@/lib/auth/guards";
import { requireLeadAccess } from "@/lib/auth/guards";
import { listCalendarPeople } from "./calendar";

/* ============================================================================
   ADR-071 — "ALSO BLOCKS": who else this meeting occupies.

   Founder: "let's say whenever X is setting a meeting and Y has to be in this
   meeting, X will look at the calendar and see if Y has any other meetings."

   Until this exists a meeting can only ever occupy its LEAD'S OWNER, so the
   one case he described — checking the colleague he needs — is the one case
   the calendar cannot answer. `technicalSupport` beside it on the same form
   cannot be it: it is free text, and a typed name is not an account.

   THE WALL IS THE LEAD'S, NOT A NEW ONE. Setting attendees goes through
   `requireLeadAccess`, so exactly the people who may already work this lead may
   say who is on its meeting — an agent cannot reach into another agent's
   meeting, and nobody gains a lead they could not open a minute ago. The list
   is then narrowed to the COMPANY's own roster, so a B-Systems meeting cannot
   be made to occupy a ByteForce-only account and quietly surface on the other
   company's grid.
   ========================================================================== */

export const attendeesSchema = z.object({
  /* the whole set, not a diff: the picker submits what the meeting should look
     like, and a replace has no lost-update window a two-call add/remove has */
  userIds: z.array(z.string().min(1)).max(20),
});
export type AttendeesInput = z.infer<typeof attendeesSchema>;

/** Replace the attendee set of one meeting. Returns the set actually stored. */
export async function setMeetingAttendees(
  meetingId: string,
  input: AttendeesInput,
  actor: CurrentUser,
): Promise<{ id: string; name: string }[]> {
  const meeting = await db.meeting.findUnique({
    where: { id: meetingId },
    select: { id: true, leadId: true, lead: { select: { brand: true } } },
  });
  /* a meeting off the partner funnel has no leadId, so there is no lead wall to
     check — and rather than invent a second one, this refuses. The calendar
     does not project those meetings either (ADR-061's exclusion, inherited). */
  if (!meeting?.leadId || !meeting.lead) throw new ApiError(404, "Meeting not found");

  await requireLeadAccess(meeting.leadId, actor);

  /* Narrow to the company's roster. An id that is not on it is DROPPED rather
     than 400'd: the picker is fed from the same roster, so a stale tab is the
     realistic way to get here, and silently storing the valid half is worse
     than storing only what is real. */
  const roster = await listCalendarPeople(meeting.lead.brand as "bsystems" | "byteforce");
  const allowed = new Map(roster.map((p) => [p.id, p]));
  const ids = [...new Set(input.userIds)].filter((id) => allowed.has(id));

  await db.$transaction([
    db.meetingAttendee.deleteMany({ where: { meetingId } }),
    db.meetingAttendee.createMany({
      data: ids.map((userId) => ({ meetingId, userId })),
      skipDuplicates: true,
    }),
  ]);

  return ids.map((id) => allowed.get(id)!);
}

/** Who is currently on this meeting — the picker's initial value. */
export async function meetingAttendees(meetingId: string): Promise<{ id: string; name: string }[]> {
  const rows = await db.meetingAttendee.findMany({
    where: { meetingId },
    select: { user: { select: { id: true, name: true } } },
  });
  return rows.map((r) => r.user);
}

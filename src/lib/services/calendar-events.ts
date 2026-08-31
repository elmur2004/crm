import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import { cairoToUtc, startOfCairoDay } from "@/lib/datetime";
import { shiftDate } from "./calendar-grid";

/* ============================================================================
   ADR-071 — writing a PERSONAL calendar entry.

   Founder: "the ability for every single user to add their own schedule on the
   calendar... it's a personal stuff, another offline meeting or something. All
   of these meetings could be added individually."

   THE OWNERSHIP RULE, and it is the whole security surface of this file: a
   personal entry belongs to the account that created it, the owner is taken
   from the SESSION and never from the request body, and every read-modify path
   below re-checks it against the row in the database. There is no admin
   override — an admin may see that a colleague is busy (that is the calendar's
   job) but may not author, rewrite or delete somebody's private time. Nothing
   here takes a `userId` argument from a caller, so no route can pass one.
   ========================================================================== */

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm");

/* A ceiling on how long one entry may run. A mistyped end year would otherwise
   paint a busy block across every cell of every month anybody ever opens — and
   an entry longer than a month is a season, not an appointment. */
export const MAX_EVENT_DAYS = 31;

export const calendarEventSchema = z
  .object({
    title: z.string().trim().min(1, "Give it a name").max(200),
    note: z.string().trim().max(2000).optional(),
    /* Cairo-local split inputs, the SPEC §6.2 shape every other form in this
       product submits — combined to ONE UTC instant here, never in the view. */
    date: dateStr,
    time: timeStr.optional(),
    endDate: dateStr.optional(),
    endTime: timeStr.optional(),
    allDay: z.boolean().default(false),
    /* the founder's per-event visibility, private side first (see the
       migration's note on why the default cannot be the other way round) */
    shared: z.boolean().default(false),
  })
  .refine((v) => v.allDay || v.time, {
    message: "Give it a start time, or mark it all-day",
    path: ["time"],
  });

export type CalendarEventInput = z.infer<typeof calendarEventSchema>;

/** The stored [startsAt, endsAt) for a submitted entry.

    An ALL-DAY entry spans whole Cairo days — from the first instant of its
    start date to the first instant of the day after its end date — so it keeps
    covering the right days across a DST jump, which a fixed +24h would not.
    A TIMED entry with no end runs one hour, the same nominal block a CRM
    meeting draws, so the two halves of the grid are the same size. */
export function eventWindow(input: CalendarEventInput): { startsAt: Date; endsAt: Date } {
  const endDate = input.endDate ?? input.date;
  if (input.allDay) {
    return { startsAt: startOfCairoDay(input.date), endsAt: startOfCairoDay(shiftDate(endDate, 1)) };
  }
  const startsAt = cairoToUtc(input.date, input.time!);
  const endsAt = input.endTime
    ? cairoToUtc(endDate, input.endTime)
    : new Date(startsAt.getTime() + 60 * 60_000);
  return { startsAt, endsAt };
}

/** Validate the window itself — the two rules a regex cannot express. */
function assertWindow(w: { startsAt: Date; endsAt: Date }) {
  if (w.endsAt <= w.startsAt) throw new ApiError(400, "It has to end after it starts");
  const days = (w.endsAt.getTime() - w.startsAt.getTime()) / 86_400_000;
  if (days > MAX_EVENT_DAYS) throw new ApiError(400, `An entry can span at most ${MAX_EVENT_DAYS} days`);
}

export interface CalendarEventRow {
  id: string;
  title: string;
  note: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  shared: boolean;
}

const ROW = {
  id: true,
  title: true,
  note: true,
  startsAt: true,
  endsAt: true,
  allDay: true,
  shared: true,
} as const;

/** Create an entry for THIS account. `userId` is the session's, always. */
export async function createCalendarEvent(
  input: CalendarEventInput,
  userId: string,
): Promise<CalendarEventRow> {
  const window = eventWindow(input);
  assertWindow(window);
  return db.calendarEvent.create({
    data: {
      userId,
      title: input.title,
      note: input.note || null,
      allDay: input.allDay,
      shared: input.shared,
      ...window,
    },
    select: ROW,
  });
}

/** Edit one of MY entries. A row owned by anybody else answers 404, not 403:
    a 403 would confirm the id exists and quietly tell an enumerating caller
    which of its guesses were real entries. */
export async function updateCalendarEvent(
  id: string,
  input: CalendarEventInput,
  userId: string,
): Promise<CalendarEventRow> {
  const existing = await db.calendarEvent.findUnique({ where: { id }, select: { userId: true } });
  if (!existing || existing.userId !== userId) throw new ApiError(404, "Entry not found");
  const window = eventWindow(input);
  assertWindow(window);
  return db.calendarEvent.update({
    where: { id },
    data: {
      title: input.title,
      note: input.note || null,
      allDay: input.allDay,
      shared: input.shared,
      ...window,
    },
    select: ROW,
  });
}

/** Delete one of MY entries.

    A HARD delete, deliberately, and the one place this module parts company
    with ADR-053's "nothing in the vault is ever deleted". A personal entry is
    not a company record: there is no audit question about somebody's dentist
    appointment, and an entry the owner removed must stop occupying their time
    on everybody else's screen — which a soft-hidden row would keep doing
    unless every reader remembered the flag. */
export async function deleteCalendarEvent(id: string, userId: string): Promise<void> {
  const existing = await db.calendarEvent.findUnique({ where: { id }, select: { userId: true } });
  if (!existing || existing.userId !== userId) throw new ApiError(404, "Entry not found");
  await db.calendarEvent.delete({ where: { id } });
}

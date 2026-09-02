import { db } from "@/lib/db";
import type { Brand, Role } from "@/lib/pipeline-engine/constants";
import { BS_CRM_ROLES, BS_PIPELINE_ROLES, MINDOO_ROLES } from "@/lib/crm/company";

/* ============================================================================
   ADR-071 — THE CALENDAR.

   Founder, verbatim: "The calendar is a page, a new page, which takes all the
   meetings that is from the meeting settings in the CRM and put it in a
   calendar, with the ability for every single user to add their own schedule
   on the calendar. So let's say whenever X is setting a meeting and Y has to
   be in this meeting, X will look at the calendar and see if Y has any other
   meetings other than the CRM. It's a personal stuff, another offline meeting
   or something."

   TWO SOURCES, ONE GRID. The CRM half is a PROJECTION over the Meeting rows
   that already exist — the To-Do's philosophy since ADR-041, and for the same
   reason: a second copy of a meeting is a copy that can drift from the board.
   The personal half is the only new state, and it belongs to a PERSON.

   ---------------------------------------------------------------------------
   THE LAW OF THIS FILE: THE CALENDAR GRANTS NOTHING.

   SPEC §3 is a hard, server-side rule — "a portal_rep can never read or mutate
   another rep's deals" — and a calendar that showed every meeting to everyone
   would repeal it on one screen while every other screen still enforced it.
   So each entry carries a DETAIL LEVEL, decided here and never in the view:

     "full"  the viewer's EXISTING scope already reaches this record. Same wall
             as requireLeadAccess and the To-Do's leadWhere, not a new one.
     "busy"  time and a name. No lead, no client, no title, no href, no note.

   A busy block answers the founder's question — is Y free at three? — and
   answers nothing else. It is the whole reason this file can exist without an
   ADR that repeals SPEC §3, and `calendar.test.ts` asserts the negative
   directly: a "busy" entry carries no title, no href and no leadId, whoever
   is looking.

   Same shape of argument as ADR-067's `companiesFor` ("NARROWING ONLY — never
   a grant") and ADR-066's `canUseModule`: the interesting property is what the
   function CANNOT return.
   ========================================================================== */

/** How far the viewer's own scope reaches — the To-Do's three kinds, because
    it is deliberately the SAME wall and not a second one that could drift. */
export type CalendarScope =
  | { kind: "all" } // bsystems admin · byteforce staff
  | { kind: "internal" } // bsystems internal sales (internal bucket)
  | { kind: "own"; userId: string }; // agent / partner — own leads only

/** The viewer, as this module needs them. */
export interface CalendarViewer {
  id: string;
  scope: CalendarScope;
}

export type CalendarKind = "meeting" | "personal";
export type CalendarDetail = "full" | "busy";

export interface CalendarPerson {
  id: string;
  name: string;
}

export interface CalendarEntry {
  kind: CalendarKind;
  /** Meeting.id or CalendarEvent.id — unique within its kind. */
  id: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  detail: CalendarDetail;
  /* Everything below is NULL on a "busy" entry, by construction — see
     `busyMeeting` / `busyPersonal`, which build the object rather than
     stripping one. A field that has to be REMOVED is a field that survives the
     day someone adds a new call site; a field that is never set cannot. */
  title: string | null;
  href: string | null;
  note: string | null;
  /** online | offline — meetings only. */
  mode: string | null;
  /** attended | cancelled | delayed — a meeting the CRM has already resolved. */
  outcome: string | null;
  leadId: string | null;
  /** whose time this occupies. A busy entry keeps this: it IS the answer. */
  people: CalendarPerson[];
  /** the viewer owns this personal entry, so may edit or delete it. */
  mine: boolean;
  /** the owner's visibility choice, and ONLY on an entry the viewer owns —
      null everywhere else. It exists so the edit form can round-trip the
      checkbox: a form that could not read the current value would re-submit
      the default and quietly un-share an entry every time its owner fixed a
      typo in it. Nobody else is told how a colleague set it. */
  shared: boolean | null;
}

/* ---------------------------------------------------------------- the roster */

/** Every role that puts a person inside this company — the same predicate
    `companiesFor` narrows with, read in the other direction. */
export function rolesForCompany(brand: Brand): Role[] {
  /* ADR-073 — a table, not a ternary: Mindoo falling through to the B-Systems
     roster would have put every B-Systems agent on Mindoo's calendar and made
     Mindoo's own staff invisible on it. */
  const byBrand: Record<Brand, Role[]> = {
    byteforce: ["byteforce_staff"],
    bsystems: [...BS_CRM_ROLES],
    mindoo: [...MINDOO_ROLES],
  };
  return byBrand[brand];
}

/** The people whose time this company's calendar shows: active accounts
    holding a role in it. This is the ONLY thing the company decides — it
    chooses whose entries you are shown, never whose time is real (a person's
    personal entries carry no company; see the migration's note). */
export async function listCalendarPeople(brand: Brand): Promise<CalendarPerson[]> {
  const rows = await db.user.findMany({
    where: { active: true, roles: { some: { role: { in: rolesForCompany(brand) } } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

/* ------------------------------------------------------------- the projection */

/* A Meeting row carries an INSTANT, never a duration — nothing in SPEC §6.2
   asks for one, and inventing a column the founder never requested would put a
   field on his form that he has to fill for no reason. So the grid gives every
   meeting the same nominal hour, purely so it can be drawn as a block. It is a
   DISPLAY constant and nothing reads it back. */
export const MEETING_BLOCK_MINUTES = 60;

const endOfMeeting = (at: Date) => new Date(at.getTime() + MEETING_BLOCK_MINUTES * 60_000);

/** Does this viewer's scope reach this lead in FULL? Deliberately the same
    three branches as requireLeadAccess — sales sees the internal bucket, an
    agent or partner sees only what they own, admin/ByteForce staff see all. */
function reaches(
  scope: CalendarScope,
  lead: { ownerType: string; ownerUserId: string | null },
): boolean {
  if (scope.kind === "all") return true;
  if (scope.kind === "internal") return lead.ownerType === "internal";
  return lead.ownerUserId === scope.userId;
}

function busyMeeting(id: string, at: Date, people: CalendarPerson[]): CalendarEntry {
  return {
    kind: "meeting",
    id,
    startsAt: at,
    endsAt: endOfMeeting(at),
    allDay: false,
    detail: "busy",
    title: null,
    href: null,
    note: null,
    mode: null,
    outcome: null,
    leadId: null,
    people,
    mine: false,
    shared: null,
  };
}

function busyPersonal(row: {
  id: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  user: { id: string; name: string };
}): CalendarEntry {
  return {
    kind: "personal",
    id: row.id,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    allDay: row.allDay,
    detail: "busy",
    title: null,
    href: null,
    note: null,
    mode: null,
    outcome: null,
    leadId: null,
    people: [{ id: row.user.id, name: row.user.name }],
    mine: false,
    shared: null,
  };
}

/** Every entry that touches [from, to) — CRM meetings and personal entries,
    each already reduced to what THIS viewer may see.

    `from`/`to` are UTC instants; the caller computes them from the Cairo month
    it is drawing (see `cairoMonthWindow`), so every window question stays in
    lib/datetime and this file never does timezone arithmetic of its own. */
export async function calendarFor(opts: {
  brand: Brand;
  viewer: CalendarViewer;
  from: Date;
  to: Date;
}): Promise<CalendarEntry[]> {
  const { brand, viewer, from, to } = opts;

  const [meetings, people, events] = await Promise.all([
    /* ADR-061's exclusion is INHERITED, not re-litigated: the partner/agent
       funnel projects nothing here either, so this reads Meeting rows that hang
       off a LEAD. `arranged: true` is the SPEC §6.2 line between an agreed
       meeting and the agent flow's merely proposed slot — an unarranged slot is
       not yet anybody's commitment and must not make a person look busy. */
    db.meeting.findMany({
      where: {
        arranged: true,
        datetime: { gte: from, lt: to },
        lead: { brand, archived: false },
      },
      select: {
        id: true,
        datetime: true,
        mode: true,
        outcome: true,
        lead: { select: { id: true, name: true, ownerType: true, ownerUserId: true } },
        attendees: { select: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { datetime: "asc" },
    }),
    listCalendarPeople(brand),
    /* OVERLAP, not containment: an entry that starts before this window and
       ends inside it still occupies time in it. A `startsAt` BETWEEN would
       silently drop every multi-day entry — a trip, a conference — which are
       exactly the ones a colleague most needs to see. */
    db.calendarEvent.findMany({
      where: { startsAt: { lt: to }, endsAt: { gt: from } },
      select: {
        id: true,
        title: true,
        note: true,
        startsAt: true,
        endsAt: true,
        allDay: true,
        shared: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  const inCompany = new Set(people.map((p) => p.id));
  const leadBase = brand === "bsystems" ? "/b-systems/crm/lead" : "/b-systems/leads/lead";
  const out: CalendarEntry[] = [];

  for (const meeting of meetings) {
    const lead = meeting.lead;
    /* a meeting with no lead cannot be scoped, so it is not shown to anyone —
       the prospect funnel reaches this table too (ADR-061), and failing CLOSED
       is the only safe reading of a row this projection does not understand */
    if (!lead || !meeting.datetime) continue;

    /* WHOSE time it occupies: the lead's owner account, plus everyone marked
       on the meeting itself. The owner may be an internal rep card with no
       login (SalesRep is not an account) — then the meeting occupies only the
       people explicitly added, which is exactly why the picker exists. */
    const occupants = new Map<string, CalendarPerson>();
    if (lead.ownerUserId && inCompany.has(lead.ownerUserId)) {
      const owner = people.find((p) => p.id === lead.ownerUserId);
      if (owner) occupants.set(owner.id, owner);
    }
    for (const a of meeting.attendees) {
      if (inCompany.has(a.user.id)) occupants.set(a.user.id, { id: a.user.id, name: a.user.name });
    }
    const occupied = [...occupants.values()];

    if (reaches(viewer.scope, lead)) {
      out.push({
        kind: "meeting",
        id: meeting.id,
        startsAt: meeting.datetime,
        endsAt: endOfMeeting(meeting.datetime),
        allDay: false,
        detail: "full",
        title: lead.name,
        href: `${leadBase}/${lead.id}?company=${brand}`,
        note: null,
        mode: meeting.mode,
        outcome: meeting.outcome,
        leadId: lead.id,
        people: occupied,
        mine: false,
        shared: null,
      });
      continue;
    }
    /* Out of scope. It becomes a busy block ONLY if it occupies somebody — an
       anonymous block against nobody's name tells the viewer nothing and would
       merely leak that the company had a meeting at all. */
    if (occupied.length > 0) out.push(busyMeeting(meeting.id, meeting.datetime, occupied));
  }

  for (const ev of events) {
    /* the roster is the wall: a person outside the company you are switched to
       does not appear on it, in any detail */
    if (!inCompany.has(ev.user.id)) continue;
    const mine = ev.user.id === viewer.id;
    if (mine || ev.shared) {
      out.push({
        kind: "personal",
        id: ev.id,
        startsAt: ev.startsAt,
        endsAt: ev.endsAt,
        allDay: ev.allDay,
        detail: "full",
        title: ev.title,
        href: null,
        /* the note is the owner's own memo — never published by `shared`,
           which the founder described as naming the entry, not annotating it */
        note: mine ? ev.note : null,
        mode: null,
        outcome: null,
        leadId: null,
        people: [{ id: ev.user.id, name: ev.user.name }],
        mine,
        shared: mine ? ev.shared : null,
      });
      continue;
    }
    out.push(busyPersonal(ev));
  }

  return out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/* ---------------------------------------------------------------- the door */

/** Who may open the calendar at all — every CRM role EXCEPT data entry.

    ADR-051 gave `bsystems_data_entry` exactly one destination, and a capability
    it never had must not arrive by the side door of a new page. Declared once,
    here, and imported by BOTH the page guard and the API routes, so the screen
    and the endpoint cannot drift into disagreeing about who is allowed in. */
export const CALENDAR_ROLES: readonly [Role, ...Role[]] = [
  ...BS_PIPELINE_ROLES,
  "byteforce_staff",
  ...MINDOO_ROLES, // ADR-073
];

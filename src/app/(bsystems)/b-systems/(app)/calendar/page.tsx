import { narrowRoles, requireCompanyPage } from "@/lib/auth/page-guards";
import { crmRolesFor } from "@/lib/crm/company";
import { bsRoleOrNull } from "@/lib/api/bsystems";
import {
  calendarFor,
  listCalendarPeople,
  type CalendarEntry,
  type CalendarScope,
} from "@/lib/services/calendar";
import { dayOfWeek, monthGrid, monthOf, parseMonth, shiftMonth } from "@/lib/services/calendar-grid";
import {
  formatCairoDate,
  formatCairoMonth,
  formatCairoTime,
  startOfCairoDay,
  utcToCairo,
} from "@/lib/datetime";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { calendarPage as m } from "@/lib/i18n/dict/calendar";
import {
  CalendarBoard,
  type CalendarDayView,
  type CalendarEntryView,
} from "@/components/shared/CalendarBoard";

export const metadata = { title: "Calendar — B-Systems CRM" };

/* ADR-071 — the calendar, one page for both companies (the To-Do's shape since
   ADR-067: the company rides the URL as `?company=`, and so does the month).

   The scope is the To-Do's, deliberately and not by coincidence: admin all,
   sales the internal bucket, agents and partners their own leads. It is handed
   to the service, which turns everything outside it into a "busy" block rather
   than dropping it — that is the whole feature, and it is why this page can
   exist without widening SPEC §3 by a single row. */

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; y?: string; m?: string }>;
}) {
  const params = await searchParams;
  const page = await requireCompanyPage(params.company);
  const { user, company } = page;

  /* ADR-067 — the shared calendar, branching on the company FIRST.

     Under ByteForce the company itself proves `byteforce_staff` (companiesFor
     only ever reports a company a role already carries), and that role has
     always seen every ByteForce lead — so the scope is the whole company, and
     no role narrowing applies. Falling through to the B-Systems narrowing
     instead would bounce every ByteForce teammate off the nav item he was just
     handed, which is the regression nav.test.ts reads this file to prevent. */
  /* ADR-073 — one company-aware narrowing, before the branches (see
     crmRolesFor). */
  narrowRoles(page, ...crmRolesFor(company));

  let scope: CalendarScope;
  if (company === "byteforce") {
    scope = { kind: "all" };
  } else if (company === "mindoo") {
    /* ADR-073 — the ByteForce shape again: one staff role, the whole company in
       scope. The privacy wall is unchanged and needs no special case — the
       roster (rolesForCompany) already answers "whose time does Mindoo show",
       and everybody outside it is a busy block exactly as before. */
    scope = { kind: "all" };
  } else {
    const role = bsRoleOrNull(user);
    scope =
      role === "bsystems_admin"
        ? { kind: "all" }
        : role === "bsystems_sales"
          ? { kind: "internal" }
          : { kind: "own", userId: user.id };
  }

  const locale = await getLocale();
  const t = tFor(locale);
  const now = new Date();
  const { year, month } = parseMonth(params.y, params.m) ?? monthOf(now);
  const grid = monthGrid(year, month);

  const [entries, people] = await Promise.all([
    calendarFor({ brand: company, viewer: { id: user.id, scope }, from: grid.from, to: grid.to }),
    listCalendarPeople(company),
  ]);

  const todayDate = utcToCairo(now).date;
  const first = grid.days[0]!.date;
  const last = grid.days[grid.days.length - 1]!.date;

  /* Which Cairo days an entry occupies, clipped to the grid.

     The last covered day is read from the instant JUST BEFORE `endsAt`, not
     from `endsAt` itself: every window in this feature is half-open, so an
     all-day entry ends at 00:00 of the following day and asking that instant
     which day it is on would paint one cell too many, every time. */
  const datesOf = (entry: CalendarEntry): string[] => {
    const start = utcToCairo(entry.startsAt).date;
    const end = utcToCairo(new Date(Math.max(entry.startsAt.getTime(), entry.endsAt.getTime() - 1)))
      .date;
    const out: string[] = [];
    for (const day of grid.days) {
      if (day.date >= start && day.date <= end) out.push(day.date);
    }
    return out.length > 0 ? out : start >= first && start <= last ? [start] : [];
  };

  const view = (entry: CalendarEntry): CalendarEntryView => {
    const allDayLabel = t(m.allDay);
    const timeLabel = entry.allDay ? allDayLabel : formatCairoTime(entry.startsAt, locale);
    const rangeLabel = entry.allDay
      ? allDayLabel
      : `${formatCairoTime(entry.startsAt, locale)} – ${formatCairoTime(entry.endsAt, locale)}`;
    /* the edit form exists ONLY for the viewer's own personal entries — a
       "busy" entry has nothing to put in it, and a meeting is edited on the
       board where its stage transition lives, never here */
    const startParts = utcToCairo(entry.startsAt);
    const endParts = utcToCairo(
      new Date(Math.max(entry.startsAt.getTime(), entry.endsAt.getTime() - (entry.allDay ? 1 : 0))),
    );
    return {
      kind: entry.kind,
      id: entry.id,
      detail: entry.detail,
      title: entry.title,
      href: entry.href,
      note: entry.note,
      mode: entry.mode,
      outcome: entry.outcome,
      timeLabel,
      rangeLabel,
      dates: datesOf(entry),
      people: entry.people,
      mine: entry.mine,
      form:
        entry.mine && entry.kind === "personal"
          ? {
              title: entry.title ?? "",
              note: entry.note ?? "",
              date: startParts.date,
              time: startParts.time,
              endDate: endParts.date,
              endTime: endParts.time,
              allDay: entry.allDay,
              /* the OWNER's stored choice, round-tripped. The service hands it
                 back only for an entry the viewer owns (null everywhere else),
                 so an edit cannot silently un-share what was shared. */
              shared: entry.shared ?? false,
            }
          : null,
    };
  };

  const days: CalendarDayView[] = grid.days.map((d) => {
    const dow = dayOfWeek(d.date);
    return {
      date: d.date,
      inMonth: d.inMonth,
      label: String(Number(d.date.slice(8, 10))),
      weekend: dow === 5 || dow === 6,
    };
  });

  const dayLabels: Record<string, string> = {};
  for (const d of grid.days) dayLabels[d.date] = formatCairoDate(startOfCairoDay(d.date), locale);

  /* The TITLE is the month, not the grid.

     `grid.from` is the first CELL, which for most months belongs to the one
     before it — August 2026 opens on Saturday, so its grid starts on 26 July —
     and formatting that instant printed "July 2026" over an August page. The
     label is taken from the first of the month itself. */
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const monthAnchor = startOfCairoDay(`${monthKey}-01`);

  const href = (y: number, mo: number) => `/b-systems/calendar?company=${company}&y=${y}&m=${mo}`;
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const thisMonth = monthOf(now);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="u-eyebrow">{t(m.eyebrow)}</div>
          <h1 className="u-h1">{t(m.title)}</h1>
          <p className="u-sub">{t(m.subtitle)}</p>
        </div>
      </div>

      <CalendarBoard
        monthLabel={formatCairoMonth(monthAnchor, locale)}
        monthKey={monthKey}
        days={days}
        weekdays={[m.sun, m.mon, m.tue, m.wed, m.thu, m.fri, m.sat].map(t)}
        todayDate={todayDate}
        initialSelected={todayDate >= first && todayDate <= last ? todayDate : `${monthKey}-01`}
        entries={entries.map(view)}
        people={people}
        selfId={user.id}
        prevHref={href(prev.year, prev.month)}
        nextHref={href(next.year, next.month)}
        todayHref={href(thisMonth.year, thisMonth.month)}
        dayLabels={dayLabels}
      />
    </div>
  );
}

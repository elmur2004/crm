import { requireMindooPage } from "@/lib/crm/mindoo";
import { MINDOO_SURFACE } from "@/lib/crm/surface";
import {
  CalendarPageBody,
  type CalendarBodyParams,
} from "@/components/shared/CalendarPageBody";

export const metadata = { title: "Calendar — Mindoo" };

/* ADR-071/074 — Mindoo's calendar. The same body every app draws, at Mindoo's
   own address, with the whole company in scope: one staff role, and it has
   always seen every Mindoo lead.

   The PRIVACY WALL is untouched and needs no special case here. It lives in the
   service: a person outside the viewer's scope is a "busy" block, never a
   dropped row and never a readable one, and the roster the columns are drawn
   from is `rolesForCompany(brand)` — so a Mindoo calendar shows Mindoo's people
   and shows everybody else's time as taken without saying by what. That was
   true when Mindoo was a segment of the merged shell and it is still true now
   that it is its own app, because the wall was never about which shell asked. */

export default async function MindooCalendarPage({
  searchParams,
}: {
  searchParams: Promise<CalendarBodyParams>;
}) {
  const user = await requireMindooPage();
  return (
    <CalendarPageBody
      ctx={MINDOO_SURFACE}
      scope={{ kind: "all" }}
      userId={user.id}
      params={await searchParams}
    />
  );
}

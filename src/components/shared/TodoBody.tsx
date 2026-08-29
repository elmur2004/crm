import type { ReactNode } from "react";
import Link from "next/link";
import { formatCairo, formatCairoDate } from "@/lib/datetime";
import { tFor, type Msg } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { todoPage as m } from "@/lib/i18n/dict/todo";
import { stageLabel } from "@/lib/i18n/dict/labels";
import { TodoCheckbox } from "@/components/shared/TodoCheckbox";
import type { TodoDoneItem, TodoItem, TodoKind, TodoLists } from "@/lib/services/todo";

/* Founder (ADR-041): "just a way of representing what I have to do today, no
   fancy stuff, so I don't miss anything." One plain list — Today. The Overdue
   section and the partner/agent pipeline rows are GONE (founder, ADR-061);
   the service no longer emits either.

   Founder 2.2/2.3 (ADR-062): every row carries a checkbox (FIRST in the row —
   the canonical to-do position, clear of the ADR-055 admin controls hugging
   the row end and of the title link; flex gap + logical properties keep it
   RTL-correct). Completed tasks appear under a Done section — struck-through,
   labelled with what completed them; a manual completion can be unchecked
   back to Today, an automatic one cannot. */

const KIND_LABEL: Record<TodoKind, Msg> = {
  follow_up: m.kindFollowUp,
  /* ADR-068 — the negotiation response date, in his own words. Same row, same
     checkbox, same Done section; only the chip tells him it is an answer he is
     waiting on. */
  negotiation_response: m.kindNegotiationResponse,
  meeting: m.kindMeeting,
  statement: m.kindStatement,
  milestone: m.kindMilestone,
};

/* Founder — "I can assign these to do as an admin or just take it myself":
   the B-Systems admin page passes `rowActions` and its rows grow a muted owner
   label, the existing Assign modal, and a one-click "Take it" (see
   components/bsystems/TodoRowActions). This list stays brand-neutral — every
   other role, and the ByteForce page, pass nothing and render exactly as
   before, without any B-Systems module in their graph. */
export async function TodoBody({
  lists,
  apiBase,
  rowActions,
}: {
  lists: TodoLists;
  /* the page's own API namespace ("/api/b-systems" | "/api/byteforce") — the
     checkbox posts there, so the brand keeps coming from the ROUTE */
  apiBase: string;
  rowActions?: (item: TodoItem) => ReactNode;
}) {
  const locale = await getLocale();
  const t = tFor(locale);

  /* what completed a Done row, in the reader's language (ADR-062) */
  const doneLabel = (item: TodoDoneItem): string => {
    const d = item.done;
    if (d.by === "manual") return t(m.doneBy).replace("{name}", d.name);
    switch (d.reason) {
      case "moved":
        return t(m.doneMoved).replace("{stage}", stageLabel(locale, d.stage));
      case "superseded":
        return t(m.doneSuperseded);
      case "meeting_outcome":
        /* Attended and Cancelled are the outcomes that COMPLETE a meeting.
           "Delayed" normally never reaches here — T-7 nulls the outcome in the
           same transaction as the reschedule (SPEC §5.8: a delayed meeting is
           a moved task, not a completed one) — but the state does exist on the
           undo path (BUG-013), so the row stays readable rather than falling
           through to "Meeting attended", which would be a lie. */
        return t(
          d.outcome === "cancelled"
            ? m.doneMeetingCancelled
            : d.outcome === "delayed"
              ? m.doneMeetingDelayed
              : m.doneMeetingAttended,
        );
      case "statement_paid":
        return t(m.donePaid);
      case "milestone_completed":
        return t(m.doneMilestone);
    }
  };

  const rows = (items: TodoItem[]) => (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={`${item.kind}-${item.recordId}`}
          className="flex items-center gap-3 text-sm flex-wrap"
        >
          <TodoCheckbox
            apiBase={apiBase}
            kind={item.kind}
            recordId={item.recordId}
            checked={false}
            ariaLabel={t(m.markDoneAria).replace("{title}", item.title)}
            errorText={t(m.checkFailed)}
          />
          <span className="text-brand-muted whitespace-nowrap">
            {formatCairo(item.at, locale, item.withTime)}
          </span>
          <span className="chip-outline shrink-0">{t(KIND_LABEL[item.kind])}</span>
          <Link href={item.href} className="font-medium underline underline-offset-2">
            {item.title}
          </Link>
          {rowActions ? rowActions(item) : null}
        </li>
      ))}
    </ul>
  );

  const doneRows = (items: TodoDoneItem[]) => (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={`${item.kind}-${item.recordId}`}
          className="flex items-center gap-3 text-sm flex-wrap"
        >
          <TodoCheckbox
            apiBase={apiBase}
            kind={item.kind}
            recordId={item.recordId}
            checked
            /* only a MANUAL completion can be unchecked back to Today —
               reversing an automatic one is a CRM action (ADR-062) */
            disabled={item.done.by !== "manual"}
            ariaLabel={t(item.done.by === "manual" ? m.restoreAria : m.autoDoneAria).replace(
              "{title}",
              item.title,
            )}
            errorText={t(m.checkFailed)}
          />
          <span className="text-brand-muted whitespace-nowrap">
            {formatCairo(item.at, locale, item.withTime)}
          </span>
          <span className="chip-outline shrink-0">{t(KIND_LABEL[item.kind])}</span>
          <Link
            href={item.href}
            className="font-medium underline underline-offset-2 text-brand-muted line-through"
          >
            {item.title}
          </Link>
          <span className="text-xs text-brand-muted">{doneLabel(item)}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{t(m.eyebrow)}</p>
          <h1 className="u-h1">
            {t(m.title)} — {formatCairoDate(new Date(), locale)}
          </h1>
        </div>
      </div>

      <section className="card card--flush0">
        <div className="card-head">
          <h2 className="u-h3">{t(m.today)}</h2>
        </div>
        <div className="card-pad">
          {lists.today.length === 0 ? (
            <p className="u-muted">{t(m.empty)}</p>
          ) : (
            rows(lists.today)
          )}
        </div>
      </section>

      {/* ADR-062 — only when nonempty (the ADR-041 Overdue precedent): the
          founder's completed tasks, today only, never silently vanished */}
      {lists.done.length > 0 ? (
        <section className="card card--flush0">
          <div className="card-head">
            <h2 className="u-h3">
              {t(m.done)} — {lists.done.length}
            </h2>
            {/* Review: the day scope is deliberate (a manual tick on a still
                pending statement is good for TODAY only — money never
                vanishes), so the section states it instead of surprising the
                founder tomorrow. card-head is flex/space-between: no physical
                left/right property, RTL-correct by order. */}
            <span className="text-xs text-brand-muted">{t(m.doneScope)}</span>
          </div>
          <div className="card-pad">{doneRows(lists.done)}</div>
        </section>
      ) : null}
    </div>
  );
}

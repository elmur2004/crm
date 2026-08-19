import type { ReactNode } from "react";
import Link from "next/link";
import { formatCairo, formatCairoDate } from "@/lib/datetime";
import { tFor, type Msg } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { todoPage as m } from "@/lib/i18n/dict/todo";
import type { TodoItem, TodoKind, TodoLists } from "@/lib/services/todo";

/* Founder (ADR-041): "just a way of representing what I have to do today, no
   fancy stuff, so I don't miss anything." Two plain lists — Overdue first
   (danger accent, only when nonempty), then Today. */

const KIND_LABEL: Record<TodoKind, Msg> = {
  follow_up: m.kindFollowUp,
  meeting: m.kindMeeting,
  prospect_follow_up: m.kindProspectFollowUp,
  prospect_meeting: m.kindProspectMeeting,
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
  rowActions,
}: {
  lists: TodoLists;
  rowActions?: (item: TodoItem) => ReactNode;
}) {
  const locale = await getLocale();
  const t = tFor(locale);

  const rows = (items: TodoItem[]) => (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={`${item.kind}-${item.href}-${i}`} className="flex items-center gap-3 text-sm flex-wrap">
          <span className="text-brand-muted whitespace-nowrap">
            {formatCairo(item.at, item.withTime)}
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

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{t(m.eyebrow)}</p>
          <h1 className="u-h1">
            {t(m.title)} — {formatCairoDate(new Date())}
          </h1>
        </div>
      </div>

      {lists.overdue.length > 0 ? (
        <section className="card card--flush0">
          <div className="card-head">
            <h2 className="u-h3 text-brand-danger">{t(m.overdue)}</h2>
          </div>
          <div className="card-pad">{rows(lists.overdue)}</div>
        </section>
      ) : null}

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
    </div>
  );
}

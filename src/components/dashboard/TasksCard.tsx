import Link from "next/link";
import { formatCairoDateRange, formatCairoTime, utcToCairo } from "@/lib/datetime";
import type { Msg } from "@/lib/i18n/core";
import { dash as m } from "@/lib/i18n/dict/dashboard";
import { todoPage } from "@/lib/i18n/dict/todo";
import type { DashboardData } from "@/lib/services/dashboard";
import type { TodoKind } from "@/lib/services/todo";
import { TodoCheckbox } from "@/components/shared/TodoCheckbox";
import { LiveNumber } from "./LiveNumber";
import { Panel } from "./Panel";
import { ProgressRing } from "./ProgressRing";
import type { DashCtx } from "./ctx";

/* W8 — today's tasks: the To-Do's OWN projection, `todoFor`, called exactly as
   the To-Do page calls it, so the two screens cannot disagree (they are the
   same call). TODAY only, by the founder's decision (ADR-061), and it says so
   in its eyebrow — the range picker does not scope this card.

   Each row is the To-Do's own checkbox (the same server-side completion wall
   applies); ticking it refreshes the page, the row leaves, and "N of M done"
   counts to its new value. The checkbox sits inside a 44px label so a thumb
   can hit it. */

const KIND: Record<TodoKind, Msg> = {
  follow_up: todoPage.kindFollowUp,
  negotiation_response: todoPage.kindNegotiationResponse,
  meeting: todoPage.kindMeeting,
  statement: todoPage.kindStatement,
  milestone: todoPage.kindMilestone,
};

export function TasksCard({ data, ctx }: { data: DashboardData; ctx: DashCtx }) {
  const { t, f } = ctx;
  const { today, todayCount, doneCount } = data.tasks;
  const total = todayCount + doneCount;
  const todayDate = utcToCairo(data.now).date;
  const more = todayCount - today.length;
  /* "{done} of {total} done" with the done figure as a live number, in either
     language's word order */
  const [before = "", after = ""] = f(m.doneOf, { total }).split("{done}");
  return (
    <Panel
      id="db-tasks"
      className="db-w-tasks"
      title={t(m.tasksTitle)}
      eyebrow={`${t(m.today)} · ${formatCairoDateRange(todayDate, todayDate, ctx.locale, { year: false })}`}
      data={{ "data-metric": "tasks", "data-value": todayCount, "data-done": doneCount }}
      action={
        <Link href={`/b-systems/todo${ctx.query}`} prefetch={false} className="db-link">
          {t(m.openTodo)}
        </Link>
      }
    >
      <div className="db-tasks-head">
        <ProgressRing fraction={total > 0 ? doneCount / total : 0} />
        <p className="db-tasks-count">
          {before}
          <bdi>
            <LiveNumber value={doneCount} />
          </bdi>
          {after}
        </p>
      </div>
      {today.length === 0 ? (
        <p className="db-empty">{t(m.nothingDue)}</p>
      ) : (
        <ul className="db-tasks">
          {today.map((item) => (
            <li key={`${item.kind}-${item.recordId}`} className="db-task">
              <label className="db-task-check">
                <TodoCheckbox
                  apiBase={ctx.apiBase}
                  kind={item.kind}
                  recordId={item.recordId}
                  checked={false}
                  ariaLabel={t(todoPage.markDoneAria).replace("{title}", item.title)}
                  errorText={t(todoPage.checkFailed)}
                />
              </label>
              <span className="db-task-body">
                <Link href={item.href} prefetch={false} className="db-task-title">
                  {item.title}
                </Link>
                <span className="db-task-meta">
                  {item.withTime ? <bdi className="db-task-time">{formatCairoTime(item.at, ctx.locale)}</bdi> : null}
                  <span className="db-pill">{t(KIND[item.kind])}</span>
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {more > 0 ? <p className="db-foot-note">{f(m.moreTasks, { n: more })}</p> : null}
    </Panel>
  );
}

import Link from "next/link";
import { formatEGP } from "@/lib/money";
import { formatCairoDate, sameCairoDay } from "@/lib/datetime";
import { dash as m } from "@/lib/i18n/dict/dashboard";
import type { RecentWin } from "@/lib/services/dashboard";
import { Panel } from "./Panel";
import type { DashCtx } from "./ctx";

/* W10 — the period's newest wins (dashboard spec W10). The status pill is the
   ONE sanctioned pink on the page besides the Won bar and step: the Won chip
   pair (--color-stage-won-chip / -ink). No commission is ever shown here
   (V2 §4 hides it from sales; it is not a KPI for the admin either). The date
   is the won-date the period is bucketed by; a contract date that differs is
   printed beside it, never used for bucketing (D15). */

export function RecentWins({ wins, ctx }: { wins: RecentWin[]; ctx: DashCtx }) {
  const { t, f } = ctx;
  const allHref = ctx.brand === "bsystems" ? "/b-systems/won-leads" : `/b-systems/clients${ctx.query}`;
  const status = (w: RecentWin) => {
    switch (w.status.kind) {
      case "collect":
        return w.status.dueDate
          ? `${f(m.toCollect, { value: formatEGP(w.status.toBeCollected) })} · ${f(m.dueOn, { date: formatCairoDate(w.status.dueDate, ctx.locale) })}`
          : f(m.toCollect, { value: formatEGP(w.status.toBeCollected) });
      case "paid":
        return t(m.paidInFull);
      case "milestone":
        return f(m.milestoneOf, { k: w.status.current, n: w.status.total });
      case "milestones_done":
        return t(m.allMilestonesDone);
      case "no_milestones":
        return t(m.noMilestones);
    }
  };
  return (
    <Panel
      id="db-wins"
      className="db-w-wins"
      title={t(m.recentWins)}
      eyebrow={ctx.curDatesShort}
      data={{ "data-metric": "recent_wins", "data-value": wins.length }}
      action={
        <Link href={allHref} prefetch={false} className="db-link">
          {t(ctx.brand === "bsystems" ? m.allWonDeals : m.allClients)}
        </Link>
      }
    >
      {wins.length === 0 ? (
        <p className="db-empty">{f(m.noWins, { dates: ctx.curDates })}</p>
      ) : (
        <ul className="db-wins">
          {wins.map((w) => (
            <li key={w.id}>
              <Link href={w.href} prefetch={false} className="db-win">
                <span className="db-win-name">
                  {w.company && w.company !== w.name ? `${w.name} · ${w.company}` : w.name}
                </span>
                <span className="db-win-value">
                  <bdi>{formatEGP(w.value)}</bdi>
                </span>
                <span className="db-win-meta">
                  <bdi>{formatCairoDate(w.wonAt, ctx.locale)}</bdi>
                  {w.contractDate && !sameCairoDay(w.contractDate, w.wonAt) ? (
                    <span> · {f(m.contractOn, { date: formatCairoDate(w.contractDate, ctx.locale) })}</span>
                  ) : null}
                  <span> · {w.owner ?? t(m.unassigned)}</span>
                </span>
                <span className="db-win-pill">{status(w)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

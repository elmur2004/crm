import { barLayout, sharePct } from "@/lib/dashboard/geometry";
import { leadTypeLabel } from "@/lib/i18n/dict/labels";
import { dash as m } from "@/lib/i18n/dict/dashboard";
import type { SourceRow } from "@/lib/services/dashboard";
import { ChartTable } from "./ChartTable";
import { LiveNumber } from "./LiveNumber";
import { Panel } from "./Panel";
import { cssVars, type DashCtx } from "./ctx";

/* W7 — lead sources as a RANKED BAR LIST, not a donut (D5). Five nominal
   categories need five distinguishable hues and the B-Systems palette cannot
   supply them without green, teal or orange (SPEC §4.3); a single-hue ranked
   list is the honest form for nominal data — every bar the same slot-1 hue
   (--color-primary), length carries the count. Sorted by count, zero rows
   last; the bars grow from the inline start. */

export function RankedBars({
  rows,
  partnerReferred,
  ctx,
}: {
  rows: SourceRow[];
  partnerReferred: number | null;
  ctx: DashCtx;
}) {
  const { t, f } = ctx;
  const total = rows.reduce((a, r) => a + r.count, 0);
  const sizes = barLayout(rows.map((r) => r.count));
  const top = rows[0];
  return (
    <Panel
      id="db-sources"
      className="db-w-sources"
      title={t(m.leadSources)}
      eyebrow={ctx.curDatesShort}
      data={{ "data-metric": "sources", "data-value": total }}
      summary={
        total === 0 || !top
          ? f(m.noLeadsAdded, { dates: ctx.curDates })
          : f(m.sourcesSummary, { type: leadTypeLabel(ctx.locale, top.type), dates: ctx.curDates, n: top.count })
      }
      table={
        <ChartTable
          label={t(m.viewAsTable)}
          head={[t(m.thSource), t(m.thLeads), t(m.thShare)]}
          rows={rows.map((r) => [leadTypeLabel(ctx.locale, r.type), String(r.count), `${sharePct(r.count, total)}%`])}
        />
      }
    >
      <ol className="db-ranked">
        {rows.map((r, i) => {
          const tipId = `db-sources-tip-${r.type}`;
          return (
            <li
              key={r.type}
              className="db-ranked-row"
              data-source={r.type}
              data-value={r.count}
              style={cssVars({ "--v": sizes[i]!.size, "--i": Math.min(i, 5) })}
            >
              <span className="db-ranked-hit db-tipwrap" tabIndex={0} aria-describedby={tipId}>
                <span className="db-ranked-label">{leadTypeLabel(ctx.locale, r.type)}</span>
                <span className="db-ranked-track" aria-hidden>
                  <span className="db-ranked-bar" />
                </span>
                <span className="db-ranked-value">
                  <bdi>
                    <LiveNumber value={r.count} />
                  </bdi>
                  <span className="db-ranked-pct">
                    <bdi>{sharePct(r.count, total)}%</bdi>
                  </span>
                </span>
              </span>
              <span role="tooltip" id={tipId} className="db-tip">
                {f(m.sourceTip, { type: leadTypeLabel(ctx.locale, r.type), n: r.count, pct: sharePct(r.count, total) })}
              </span>
            </li>
          );
        })}
      </ol>
      {partnerReferred !== null ? (
        <p className="db-foot-note">{f(m.partnerReferred, { n: partnerReferred })}</p>
      ) : null}
    </Panel>
  );
}

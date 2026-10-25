import { linePath } from "@/lib/dashboard/geometry";
import { ratePct } from "@/lib/dashboard/delta";
import { formatCairoMonthShort } from "@/lib/datetime";
import { monthPeriod } from "@/lib/dashboard/periods";
import { dash as m } from "@/lib/i18n/dict/dashboard";
import type { TrendPoint } from "@/lib/services/dashboard";
import { ChartTable } from "./ChartTable";
import { Panel } from "./Panel";
import type { DashCtx } from "./ctx";

/* W11 — win rate, last six Cairo months (dashboard spec W11, same definitions
   as K3). A month with nothing decided is a GAP in the line — never a 0%,
   which would read as six months of losing.

   ONE axis, 0–100%, recessive gridlines at 50% and 100%. The TIME axis is NOT
   mirrored in Arabic (Material's bidirectionality guide lists charts and
   graphs among the things that are not mirrored; D11b) — oldest at the left in
   both languages, the y labels on the inline-start side.

   The hit targets are six HTML columns over the SVG, each focusable and
   holding its month's reading as text; the crosshair snaps to the column under
   the pointer or the focus, and its tooltip opens on hover, focus and tap. */

/* Two drawings share one height (and so one set of gridline percentages, which
   the HTML y labels and hit columns rely on): a wide one for a wide card and a
   narrower one — taller on screen — for a phone. Uniform scaling keeps the
   dots round and the line weight even. */
const H = 200;
const PAD_T = 12;
const PAD_B = 12;
const WIDE = 600;
const NARROW = 300;

export function TrendLine({ points, ctx }: { points: TrendPoint[]; ctx: DashCtx }) {
  const { t, f } = ctx;
  const n = points.length;
  const plotH = H - PAD_T - PAD_B;
  const rates = points.map((p) => ratePct(p));
  const monthName = (month: string, year = false) =>
    formatCairoMonthShort(monthPeriod(month).start, ctx.locale, { year });
  const reading = (p: TrendPoint, i: number) =>
    rates[i] === null
      ? f(m.trendGapTip, { month: monthName(p.month, true) })
      : f(m.trendTip, { month: monthName(p.month, true), pct: rates[i]!, won: p.won, lost: p.lost });
  const lastIdx = rates.map((r, i) => (r === null ? -1 : i)).filter((i) => i >= 0).at(-1);
  const gridY = (v: number) => PAD_T + (1 - v) * plotH;

  return (
    <Panel
      id="db-trend"
      className="db-w-trend"
      title={t(m.winRateTrend)}
      eyebrow={t(m.last6Months)}
      data={{ "data-metric": "win_rate_trend", "data-rates": JSON.stringify(rates) }}
      summary={
        lastIdx === undefined
          ? t(m.trendEmpty)
          : f(m.trendSummary, { pct: rates[lastIdx]!, month: monthName(points[lastIdx]!.month, true) })
      }
      table={
        <ChartTable
          label={t(m.viewAsTable)}
          head={[t(m.thMonth), t(m.thWon), t(m.thLost), t(m.thRate)]}
          rows={points.map((p, i) => [
            monthName(p.month, true),
            String(p.won),
            String(p.lost),
            rates[i] === null ? "—" : `${rates[i]}%`,
          ])}
        />
      }
    >
      <div className="db-trend">
        <div className="db-trend-plot db-chart">
          <span className="db-trend-y" aria-hidden style={{ insetBlockStart: `${(gridY(1) / H) * 100}%` }}>
            100%
          </span>
          <span className="db-trend-y" aria-hidden style={{ insetBlockStart: `${(gridY(0.5) / H) * 100}%` }}>
            50%
          </span>
          <TrendSvg W={WIDE} rates={rates} n={n} plotH={plotH} gridY={gridY} variant="wide" />
          <TrendSvg W={NARROW} rates={rates} n={n} plotH={plotH} gridY={gridY} variant="narrow" />
          <div className="db-trend-cols">
            <div className="db-trend-cols-grid" dir="ltr">
            {points.map((p, i) => {
              const tipId = `db-trend-tip-${p.month}`;
              return (
                <div key={p.month} className="db-trend-col">
                  <span className="db-trend-hit db-tipwrap" tabIndex={0} aria-describedby={tipId}>
                    <span className="sr-only">{monthName(p.month, true)}</span>
                  </span>
                  <span role="tooltip" id={tipId} className="db-tip" dir={ctx.dir}>
                    {reading(p, i)}
                  </span>
                </div>
              );
            })}
            </div>
          </div>
        </div>
        <div className="db-trend-x" aria-hidden>
          <div className="db-trend-x-grid" dir="ltr">
            {points.map((p) => (
              <span key={p.month}>{monthName(p.month)}</span>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function TrendSvg({
  W,
  rates,
  n,
  plotH,
  gridY,
  variant,
}: {
  W: number;
  rates: (number | null)[];
  n: number;
  plotH: number;
  gridY: (v: number) => number;
  variant: "wide" | "narrow";
}) {
  const colW = W / Math.max(1, n);
  const { d, xs, ys } = linePath(
    rates.map((r) => (r === null ? null : r / 100)),
    W - colW,
    plotH,
    { dir: "ltr" },
  );
  return (
    <svg
      className={`db-trend-svg db-trend-svg--${variant}`}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden
      focusable="false"
    >
      <line className="db-gridline" x1={0} x2={W} y1={gridY(1)} y2={gridY(1)} />
      <line className="db-gridline" x1={0} x2={W} y1={gridY(0.5)} y2={gridY(0.5)} />
      <line className="db-axis" x1={0} x2={W} y1={gridY(0)} y2={gridY(0)} />
      <g transform={`translate(${colW / 2} ${PAD_T})`}>
        {d ? <path className="db-trend-line db-draw" d={d} pathLength={1} /> : null}
        {ys.map((y, i) =>
          y === null ? null : <circle key={i} className="db-trend-dot" cx={xs[i]} cy={y} r={6} />,
        )}
      </g>
    </svg>
  );
}

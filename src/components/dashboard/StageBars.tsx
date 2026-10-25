import { barLayout, sharePct } from "@/lib/dashboard/geometry";
import { stageKey } from "@/components/bsystems/stageColors";
import { stageLabel } from "@/lib/i18n/dict/labels";
import { dash as m } from "@/lib/i18n/dict/dashboard";
import { LiveNumber } from "./LiveNumber";
import { cssVars, type DashCtx } from "./ctx";

/* Leads per stage as bars (dashboard spec W5) — ONE DOM, two shapes: vertical
   columns in a wide card, horizontal rows below a 520px card (a container
   query; the page never scrolls sideways).

   Every bar wears its stage's own --stage-bar, exactly the colour of the board
   column it summarises, and prints its stage name and count — colour is a
   redundant identity, never the only channel. The bars follow the document
   direction (RTL reverses them like the board's own columns).

   Each bar is a focusable element holding its label and count as text, with a
   tooltip ("Meeting Setting: 7 · 23% of all leads") that opens on hover, on
   keyboard focus AND on a tap (a tap focuses it) — which is why the bars are
   not links: on a phone a link would navigate before the tooltip could open.
   The card links to the board in its head instead. */

export interface StageBarItem {
  stage: string;
  count: number;
}

export function StageBars({
  items,
  ctx,
  idPrefix,
  metricPrefix,
}: {
  items: StageBarItem[];
  ctx: DashCtx;
  idPrefix: string;
  /** "stage" → data-metric="stage:lost" (journey 2 reads it) */
  metricPrefix: string;
}) {
  const sizes = barLayout(items.map((i) => i.count));
  const total = items.reduce((a, i) => a + i.count, 0);
  const label = (stage: string) => (stage === "new" ? ctx.t(m.newNotActioned) : stageLabel(ctx.locale, stage));
  return (
    <div className="db-chart db-stagebars-wrap">
      <ol className="db-stagebars">
        {items.map((item, i) => {
          const tipId = `${idPrefix}-tip-${item.stage}`;
          return (
            <li
              key={item.stage}
              className="db-stagebar"
              data-stage-key={stageKey(item.stage)}
              data-metric={`${metricPrefix}:${item.stage}`}
              data-value={item.count}
              style={cssVars({ "--v": sizes[i]!.size, "--i": Math.min(i, 5) })}
            >
              <span className="db-stagebar-hit db-tipwrap" tabIndex={0} aria-describedby={tipId}>
                <span className="db-stagebar-track" aria-hidden>
                  <span className="db-stagebar-fill" />
                </span>
                <span className="db-stagebar-label">{label(item.stage)}</span>
                <span className="db-stagebar-value">
                  <LiveNumber value={item.count} />
                </span>
              </span>
              <span role="tooltip" id={tipId} className="db-tip">
                {ctx.f(m.stageTip, { stage: label(item.stage), n: item.count, pct: sharePct(item.count, total) })}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The "View as table" rows for a set of stage bars. */
export function stageTableRows(items: StageBarItem[], ctx: DashCtx): string[][] {
  const total = items.reduce((a, i) => a + i.count, 0);
  return items.map((i) => [
    i.stage === "new" ? ctx.t(m.newNotActioned) : stageLabel(ctx.locale, i.stage),
    String(i.count),
    `${sharePct(i.count, total)}%`,
  ]);
}

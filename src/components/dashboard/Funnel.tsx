import Link from "next/link";
import { funnelLayout } from "@/lib/dashboard/geometry";
import { stageLabel } from "@/lib/i18n/dict/labels";
import { configForBrand } from "@/lib/pipeline-engine/configs/for-brand";
import { dash as m } from "@/lib/i18n/dict/dashboard";
import type { FunnelStep } from "@/lib/services/dashboard";
import { ChartTable } from "./ChartTable";
import { LiveNumber } from "./LiveNumber";
import { Panel } from "./Panel";
import { cssVars, type DashCtx } from "./ctx";

/* W6 — the pipeline funnel, as a COHORT (dashboard spec §3.2): of the leads
   ADDED in the period, how many got at least as far as each step. Nested by
   construction, so the narrowing shape is a real conversion, never an
   invented one (a snapshot of stage counts is not a funnel — that is W5).

   The bars are CENTRED, so the shape reads the same in both directions. One
   hue for every step (--color-primary); the final Won step wears the Won cue
   (--color-stage-won-accent), the one place pink belongs. Width carries the
   magnitude; each step prints "count · % of added". */

export function Funnel({ steps, ctx }: { steps: FunnelStep[]; ctx: DashCtx }) {
  const { t, f } = ctx;
  const layout = funnelLayout(steps.map((s) => s.count));
  const label = (key: string) => (key === "added" ? t(m.added) : stageLabel(ctx.locale, key));
  const added = steps[0]?.count ?? 0;
  /* pink belongs to the WON step by name — never to "whichever step is last" */
  const wonStage = configForBrand(ctx.brand).wonStage;
  return (
    <Panel
      id="db-funnel"
      className="db-w-funnel"
      title={t(m.funnel)}
      eyebrow={ctx.curDatesShort}
      data={{ "data-metric": "funnel", "data-steps": JSON.stringify(steps.map((s) => s.count)) }}
      summary={
        added === 0
          ? f(m.noLeadsAdded, { dates: ctx.curDates })
          : f(m.funnelSummary, { pct: layout.at(-1)?.pctOfFirst ?? 0, dates: ctx.curDates })
      }
      table={
        <ChartTable
          label={t(m.viewAsTable)}
          head={[t(m.thStep), t(m.thReached), t(m.thOfAdded)]}
          rows={steps.map((s, i) => [label(s.key), String(s.count), `${layout[i]!.pctOfFirst}%`])}
        />
      }
    >
      {added === 0 ? (
        <p className="db-empty">
          <Link href={`/b-systems/leads${ctx.query}`} prefetch={false} className="db-link">
            {t(m.addLead)}
          </Link>
        </p>
      ) : (
        <ol className="db-funnel">
          {steps.map((s, i) => {
            const l = layout[i]!;
            const tipId = `db-funnel-tip-${s.key}`;
            const prev = i > 0 ? steps[i - 1]! : null;
            return (
              <li
                key={s.key}
                className={`db-funnel-step${s.key === wonStage ? " db-funnel-step--won" : ""}`}
                style={cssVars({ "--w": l.widthPct / 100, "--i": Math.min(i, 5) })}
              >
                <span className="db-funnel-hit db-tipwrap" tabIndex={0} aria-describedby={tipId}>
                  <span className="db-funnel-label">{label(s.key)}</span>
                  <span className="db-funnel-track" aria-hidden>
                    <span className="db-funnel-bar" />
                  </span>
                  <span className="db-funnel-value">
                    <bdi>
                      <LiveNumber value={s.count} />
                    </bdi>
                    <span className="db-funnel-pct"> · {f(m.ofAdded, { pct: l.pctOfFirst })}</span>
                  </span>
                </span>
                <span role="tooltip" id={tipId} className="db-tip">
                  {prev
                    ? f(m.funnelStepTip, {
                        count: s.count,
                        prev: prev.count,
                        stage: label(s.key),
                        pct: l.pctOfPrev ?? 0,
                      })
                    : f(m.funnelFirstTip, { count: s.count, dates: ctx.curDates })}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <p className="db-caption">{f(m.funnelCaption, { dates: ctx.curDates })}</p>
    </Panel>
  );
}

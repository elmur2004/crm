import { deltaArrow, deltaFigure, deltaTone, type Delta } from "@/lib/dashboard/delta";
import { dash as m } from "@/lib/i18n/dict/dashboard";
import type { DashCtx } from "./ctx";

/* "↑ +33%" — the KPI delta (dashboard spec §2.2).

   COLOUR IS NEVER THE ONLY CHANNEL: the arrow, the sign and the number say the
   same thing the tone does. Favourable rides the primary tint, unfavourable the
   danger tint, and the word kinds ("New", "No change", "—") a neutral pill on
   the page ground with a border (muted on --color-hairline fails AA in light).
   No green (SPEC §4.3) and no pink (pink is the Won cue only).

   The visible pill is aria-hidden; its screen-reader sentence names the change
   and BOTH figures ("up 33% from EGP 150,000 in 1–25 Sep 2026"), because the
   card around it already reads its own label and value. */

export function DeltaBadge({
  delta,
  prevText,
  ctx,
  onDark = false,
}: {
  delta: Delta;
  /** the previous period's figure, already formatted ("EGP 150,000", "3", "33%") */
  prevText: string;
  ctx: DashCtx;
  /** the hero card sits on --color-chrome: one translucent pill, in on-chrome ink */
  onDark?: boolean;
}) {
  const { t, f } = ctx;
  const figure = deltaFigure(delta);
  const tone = deltaTone(delta);
  const word =
    delta.kind === "new" ? t(m.deltaNew) : delta.kind === "same" ? t(m.deltaSame) : delta.kind === "na" ? t(m.deltaNa) : null;
  const change =
    delta.kind === "pts"
      ? f(m.percentPoints, { n: figure?.replace(/^[+−]/, "") ?? "" })
      : (figure ?? "").replace(/^[+−]/, "");
  const sr =
    delta.kind === "pct" || delta.kind === "pts"
      ? f(delta.dir === "up" ? m.srUp : m.srDown, { change, prev: prevText, dates: ctx.prevDates })
      : delta.kind === "new"
        ? f(m.srNew, { dates: ctx.prevDates })
        : delta.kind === "same"
          ? f(m.srSame, { prev: prevText, dates: ctx.prevDates })
          : f(m.srNa, { dates: ctx.prevDates });

  return (
    <span
      className={`db-delta db-delta--${onDark ? "on-dark" : tone}`}
      data-delta={delta.kind === "pct" || delta.kind === "pts" ? delta.dir : delta.kind}
      title={delta.kind === "na" ? t(m.notEnoughToCompare) : f(m.vsDates, { dates: ctx.prevDates })}
    >
      <span aria-hidden className="db-delta-face">
        {figure ? (
          <>
            <span className="db-delta-arrow">{deltaArrow(delta)}</span>
            <bdi>{figure}</bdi>
            {delta.kind === "pts" ? <span className="db-delta-unit">{t(m.pts)}</span> : null}
          </>
        ) : (
          word
        )}
      </span>
      <span className="sr-only">{sr}</span>
    </span>
  );
}

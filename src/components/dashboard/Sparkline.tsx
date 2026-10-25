import { linePath, normalise } from "@/lib/dashboard/geometry";

/* A six-month sparkline (dashboard spec W1/W2). Decorative — aria-hidden; the
   card's own sentence carries the trend. Server-rendered at its final shape,
   so it is correct with no JavaScript; the draw-in is CSS (stroke-dashoffset,
   once per visit, reduced-motion respected) and never moves a value.

   A TIME axis, so it is not mirrored in Arabic (dashboard spec §6.4, D11b):
   oldest month at the left in both languages. A flat zero series draws a flat
   baseline — zero is a real answer, not "no data". */

const W = 200;
const H = 40;
const PAD = 3;

export function Sparkline({ values, className = "" }: { values: number[]; className?: string }) {
  const points = normalise(values);
  const { d, xs, ys } = linePath(points, W - PAD * 2, H - PAD * 2);
  const last = ys.length - 1;
  return (
    <svg
      className={`db-spark ${className}`}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden
      focusable="false"
    >
      <g transform={`translate(${PAD} ${PAD})`}>
        <path className="db-spark-line db-draw" d={d} pathLength={1} />
        {last >= 0 && ys[last] !== null ? (
          <circle className="db-spark-dot" cx={xs[last]} cy={ys[last]!} r={3} />
        ) : null}
      </g>
    </svg>
  );
}

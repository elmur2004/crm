import { arcPath } from "@/lib/dashboard/geometry";
import { cssVars } from "./ctx";

/* The win-rate gauge (dashboard spec W3) — a semicircle that fills from the
   inline START, like every meter in the house ([dir="rtl"] .meter-fill), so in
   Arabic it fills from the right. Decorative: the rate is printed beside it.
   The fill is the full arc drawn with a dash of `fraction`, which is what lets
   CSS draw it in once (stroke-dashoffset) without a second geometry. An empty
   track is the honest picture of "no closed deals". */

const R = 44;
const SW = 10;

export function SemiMeter({ fraction, dir }: { fraction: number | null; dir: "ltr" | "rtl" }) {
  const track = arcPath(1, R, { dir });
  const f = fraction === null ? 0 : Math.max(0, Math.min(1, fraction));
  return (
    <svg
      className="db-meter"
      viewBox={`${-SW / 2} ${-SW / 2} ${2 * R + SW} ${R + SW}`}
      aria-hidden
      focusable="false"
    >
      <path className="db-meter-track" d={track} />
      {f > 0 ? (
        <path
          className="db-meter-fill db-draw"
          d={track}
          pathLength={1}
          style={cssVars({ "--dash": f })}
        />
      ) : null}
    </svg>
  );
}

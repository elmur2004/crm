import { ringDash } from "@/lib/dashboard/geometry";

/* The To-Do card's "done ÷ (done + today)" ring (dashboard spec W8).
   Decorative — the "4 of 9 done" text beside it is the value. */

const R = 15;

export function ProgressRing({ fraction }: { fraction: number }) {
  const { circumference, offset } = ringDash(fraction, R);
  return (
    <svg className="db-ring" viewBox="0 0 40 40" aria-hidden focusable="false">
      <circle className="db-ring-track" cx={20} cy={20} r={R} />
      <circle
        className="db-ring-fill"
        cx={20}
        cy={20}
        r={R}
        transform="rotate(-90 20 20)"
        style={{ strokeDasharray: `${circumference}`, strokeDashoffset: `${offset}` }}
      />
    </svg>
  );
}

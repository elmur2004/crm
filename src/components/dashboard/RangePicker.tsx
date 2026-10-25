import Link from "next/link";
import { RANGE_KEYS, type RangeKey } from "@/lib/dashboard/periods";
import { dash as m, rangeLabels } from "@/lib/i18n/dict/dashboard";
import type { DashCtx } from "./ctx";

/* W0b — the period picker. ZERO JavaScript of its own: a <button popovertarget>
   and a `popover` list of plain links to ?company=…&range=…. Light-dismiss and
   Escape come with the Popover API. The selected preset carries a check and
   aria-current; every row is at least 44px tall. Styled as a bottom sheet on a
   phone and a menu under the button on a desktop (dashboard.css).

   The links are Next <Link>s so a switch is a client navigation: the DOM is
   kept, the numbers count to their new values and the bars ease to their new
   lengths instead of redrawing. They still work with JavaScript off (they are
   anchors). The list is KEYED by the range, so the open popover is replaced —
   and so closed — the moment the new period renders. */

export function RangePicker({ range, ctx }: { range: RangeKey; ctx: DashCtx }) {
  const { t } = ctx;
  const id = "db-range-menu";
  return (
    <div className="db-range">
      <button type="button" className="db-range-btn" popoverTarget={id} aria-haspopup="true">
        <span className="db-range-label">{t(m.period)}</span>
        <span className="db-range-value">{t(rangeLabels[range])}</span>
        <span className="db-range-caret" aria-hidden>
          ▾
        </span>
      </button>
      <div key={range} id={id} popover="auto" className="db-range-menu" aria-label={t(m.choosePeriod)}>
        <p className="db-range-menu-title">{t(m.choosePeriod)}</p>
        <ul>
          {RANGE_KEYS.map((key) => (
            <li key={key}>
              <Link
                href={`/b-systems${ctx.query}&range=${key}`}
                prefetch={false}
                scroll={false}
                className="db-range-opt"
                aria-current={key === range ? "true" : undefined}
                data-range={key}
              >
                <span className="db-range-check" aria-hidden>
                  {key === range ? "✓" : ""}
                </span>
                {t(rangeLabels[key])}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

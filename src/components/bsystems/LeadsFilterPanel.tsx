"use client";

import { useState } from "react";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { leadsFilters as lf } from "@/lib/i18n/dict/crm";

/* Founder (filters round 2): "make it as a sidebar". On desktop the filter card
   is simply the start-side column — this wrapper's toggle is hidden by CSS. On
   narrow screens the same card collapses behind a "Filters" disclosure that
   carries a count chip of the active (non-default) filters, so the table keeps
   the full width. The controls themselves are server-rendered children (a plain
   GET form) — this component only owns the open/closed state. */

export function LeadsFilterPanel({
  activeCount,
  children,
}: {
  activeCount: number;
  children: React.ReactNode;
}) {
  const t = tFor(useLocale());
  const [open, setOpen] = useState(false);
  return (
    <div className="filter-panel">
      <button
        type="button"
        className="filter-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {t(lf.filters)}
        {activeCount > 0 ? (
          <span className="filter-count" aria-label={`${activeCount} ${t(lf.activeCount)}`}>
            {activeCount}
          </span>
        ) : null}
      </button>
      <div className="filter-body" data-open={open ? "true" : "false"}>
        {children}
      </div>
    </div>
  );
}

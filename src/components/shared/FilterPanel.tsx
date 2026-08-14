"use client";

import { useState } from "react";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { leadsFilters as lf } from "@/lib/i18n/dict/crm";

/* Founder (filters round 2 + 3): "make it as a sidebar" on the Leads list, and
   "add the search and the filtrations on the CRM cards page" too.

   One component, two shapes:
   - variant "side"   — the disclosure IS the narrow-screen shape; from 900px up
     CSS hides the toggle and pins the card open as the sidebar column.
   - variant "inline" — the disclosure at EVERY width, sitting above the content.
     The boards use this: .board is a full-bleed breakout (margin-inline:
     calc(50% - 50vw)) whose alignment math is relative to its container, so a
     fixed side column would be painted over by the board itself.

   The controls are server-rendered children (a plain GET form) — this component
   only owns the open/closed state. It opens by default when something is
   already filtered, so the active state is never hidden behind a click. */

export function FilterPanel({
  activeCount,
  variant = "side",
  defaultOpen = false,
  children,
}: {
  activeCount: number;
  variant?: "side" | "inline";
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const t = tFor(useLocale());
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`filter-panel filter-panel--${variant}`}>
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

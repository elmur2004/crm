"use client";

import { useEffect, useMemo, useState } from "react";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { board as msg } from "@/lib/i18n/dict/crm";
import { utcToCairo } from "@/lib/datetime";

/* The chip's day filter, shared by both boards' Following Up columns (ADR-042
   parity — one behavior, one place). The Cairo day is sampled AFTER mount and
   RE-sampled on every press, never during render: the boards are SSR'd, and a
   render-time clock can hydration-mismatch (and quietly go stale) across Cairo
   midnight (review). SSR therefore paints "Today · 0" for one beat; the mounted
   count follows immediately, and a tab left open past midnight filters on the
   PRESS day. One memoized pass computes count and visible together — one
   utcToCairo day-string per card against one precomputed today (same day-
   definition as sameCairoDay, pinned by the datetime unit test).

   ADR-064 — the SAME hook now serves the Meeting Setting columns too, so it
   asks the caller which instant a card is filtered on instead of reaching for
   `followUpDueAt` itself: `at` is the accessor, and passing `null` is how a
   column says it has no chip. Pass a STABLE accessor (a module-level const, as
   all three boards do) — it is a memo dependency. */
export function useTodayFilter<T>(
  items: T[],
  at: ((item: T) => string | null) | null,
  landedHere = 0,
): { todayOnly: boolean; toggle: () => void; todayCount: number; visible: T[] } {
  const [todayOnly, setTodayOnly] = useState(false);
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(utcToCairo(new Date()).date), []);
  /* Review — a card just LANDED in this column, so the filter lets go. Drop a
     card into a filtered column and it is very often not a card the filter
     keeps, and it then renders NOWHERE: the rep drags it in and watches it
     vanish. On Meeting Setting that is the near-certain case rather than the
     exotic one, because the drop form defaults to "not arranged" and an
     unarranged meeting stores no datetime at all — so the freshly dropped card
     can never be a meeting today. Releasing shows the rep the move they just
     made; the chip is one press away and its count is unchanged.
     `landedHere` counts drops into THIS column (0 = none yet, so the mount
     pass is a no-op, and every board that passes nothing keeps the old
     behaviour). */
  useEffect(() => {
    if (landedHere > 0) setTodayOnly(false);
  }, [landedHere]);
  const todays = useMemo(
    () =>
      at && today
        ? items.filter((item) => {
            const instant = at(item);
            return instant !== null && utcToCairo(new Date(instant)).date === today;
          })
        : [],
    [items, at, today],
  );
  return {
    todayOnly,
    toggle: () => {
      setToday(utcToCairo(new Date()).date);
      setTodayOnly((v) => !v);
    },
    todayCount: todays.length,
    visible: todayOnly ? todays : items,
  };
}

/* Founder (ADR-061): "make a little filter in top of the follow up column
   called today when you can just see today's follow ups."
   Founder (ADR-064): "also add the today filter on top" — of Meeting Setting.

   A small toggle chip in a column head. Purely client-side over the already-
   loaded cards; default OFF. The count is the number of cards whose instant
   falls on today's CAIRO calendar day — it names what pressing the chip will
   show and does not change with the toggle. A real <button> with aria-pressed
   so the state is announced; colors ride the column's stage vars (tokens only,
   see .today-chip in design-system.css).

   It rides FIVE column heads now: Following Up and Meeting Setting on both lead
   boards, and Meeting Setting on the prospect board — which ADR-061 skipped
   only because ADR-059 left it no follow-up column, never because the founder
   wanted less there. */
export function TodayChip({
  count,
  pressed,
  onToggle,
}: {
  count: number;
  pressed: boolean;
  onToggle: () => void;
}) {
  const t = tFor(useLocale());
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className="today-chip"
    >
      {t(msg.todayFilter)} · {count}
    </button>
  );
}

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
   definition as sameCairoDay, pinned by the datetime unit test). */
export function useTodayFilter<T extends { followUpDueAt: string | null }>(
  leads: T[],
  enabled: boolean,
): { todayOnly: boolean; toggle: () => void; todayCount: number; visible: T[] } {
  const [todayOnly, setTodayOnly] = useState(false);
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(utcToCairo(new Date()).date), []);
  const todays = useMemo(
    () =>
      enabled && today
        ? leads.filter(
            (l) => l.followUpDueAt && utcToCairo(new Date(l.followUpDueAt)).date === today,
          )
        : [],
    [leads, enabled, today],
  );
  return {
    todayOnly,
    toggle: () => {
      setToday(utcToCairo(new Date()).date);
      setTodayOnly((v) => !v);
    },
    todayCount: todays.length,
    visible: todayOnly ? todays : leads,
  };
}

/* Founder (ADR-061): "make a little filter in top of the follow up column
   called today when you can just see today's follow ups."

   A small toggle chip in the Following Up column head of BOTH lead boards
   (ADR-042 parity). Purely client-side over the already-loaded cards; default
   OFF. The count is the number of cards whose latest follow-up is due on
   today's CAIRO calendar day — it names what pressing the chip will show and
   does not change with the toggle. A real <button> with aria-pressed so the
   state is announced; colors ride the column's stage vars (tokens only, see
   .today-chip in design-system.css). The prospect board gets no chip: since
   ADR-059 it has no follow-up column to put one on. */
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

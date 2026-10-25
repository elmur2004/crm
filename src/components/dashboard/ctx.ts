import type { CSSProperties } from "react";
import { formatMsg, tFor, type Locale, type Msg } from "@/lib/i18n/core";
import { formatCairoDateRange } from "@/lib/datetime";
import type { Brand } from "@/lib/pipeline-engine/constants";
import type { PeriodPair } from "@/lib/dashboard/periods";

/* What every Home widget needs to render itself: the reader's language and
   direction, the company, and the period's dates already in words. Built once
   by DashboardBody so no widget formats a date range of its own. */

export interface DashCtx {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: (m: Msg) => string;
  /** fill a {placeholder} template in the reader's language */
  f: (m: Msg, vars: Record<string, string | number>) => string;
  brand: Brand;
  /** "?company=bsystems" */
  query: string;
  /** the API namespace the To-Do checkbox posts to */
  apiBase: string;
  /** "1–25 Oct 2026" */
  curDates: string;
  /** "1–25 Oct" — the mono eyebrow (uppercased by CSS) */
  curDatesShort: string;
  /** "1–25 Sep 2026" — what "vs" compares with */
  prevDates: string;
}

export function makeCtx(opts: {
  locale: Locale;
  brand: Brand;
  query: string;
  apiBase: string;
  period: PeriodPair;
}): DashCtx {
  const t = tFor(opts.locale);
  const { current, previous } = opts.period;
  return {
    locale: opts.locale,
    dir: opts.locale === "ar" ? "rtl" : "ltr",
    t,
    f: (m, vars) =>
      formatMsg(m, Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, String(v)])))[opts.locale],
    brand: opts.brand,
    query: opts.query,
    apiBase: opts.apiBase,
    curDates: formatCairoDateRange(current.from, current.to, opts.locale),
    curDatesShort: formatCairoDateRange(current.from, current.to, opts.locale, { year: false }),
    prevDates: formatCairoDateRange(previous.from, previous.to, opts.locale),
  };
}

/** A Latin-digit figure, isolated for an Arabic sentence. */
export const num = (n: number) => String(n);

/** CSS custom properties for an inline style (geometry only — never a colour:
    every colour is a token the stylesheet reads). */
export const cssVars = (o: Record<`--${string}`, string | number>) => o as CSSProperties;

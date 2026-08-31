/* Store UTC, display Africa/Cairo (SPEC §2). This module owns every combine/split
   between the UI's Cairo-local date+time inputs (§6.2 shape) and the single stored
   UTC instant — DST-safe via Intl, no fixed offsets.

   TWO LAYERS, AND THEY ARE NOT THE SAME (ADR-068). The WIRE layer —
   cairoToUtc / wallClockParts / utcToCairo / sameCairoDay — is arithmetic: it
   speaks 24-hour "HH:mm" because that is what an <input type="time"> submits,
   what the group schema's regex accepts, and what every Cairo-day window and
   DST anchor is computed from. The DISPLAY layer — formatCairo /
   formatCairoDate / formatCairoShort — is the only thing a person reads, and
   since the founder's request it is TWELVE-HOUR in both languages. Changing
   one layer never changes the other. */

import type { Locale } from "@/lib/i18n/core";

export const TIME_ZONE = "Africa/Cairo";

/** Cairo-local "YYYY-MM-DD" + "HH:mm" → UTC Date. DST-safe (iterative offset fix). */
export function cairoToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if ([y, m, d, hh, mm].some((v) => !Number.isFinite(v))) {
    throw new Error(`Invalid date/time: ${date} ${time}`);
  }
  // Start from the wall-clock interpreted as UTC, then correct by the zone offset.
  let utc = Date.UTC(y!, m! - 1, d!, hh!, mm!);
  for (let i = 0; i < 3; i++) {
    const local = wallClockParts(new Date(utc));
    const localAsUtc = Date.UTC(local.y, local.m - 1, local.d, local.hh, local.mm);
    const diff = Date.UTC(y!, m! - 1, d!, hh!, mm!) - localAsUtc;
    if (diff === 0) break;
    utc += diff;
  }
  return new Date(utc);
}

/* ONE cached formatter — the boards' Today chip runs utcToCairo per card
   (review), and constructing an Intl.DateTimeFormat is the expensive part.
   The options never change, so the instance is safely shared. */
let wallClockFmt: Intl.DateTimeFormat | undefined;

/* DO NOT make this one twelve-hour. `hour12: false` here is STORAGE, not
   display: these parts feed cairoToUtc's offset solver, utcToCairo,
   sameCairoDay and every Cairo-day window (the To-Do's today, the boards'
   Today chip, followUpDueAt's DST re-anchor). The `% 24` below exists to
   normalise the "24" that hourCycle h24 emits at midnight — it CANNOT correct
   the "12" that `hour12: true` emits there, so flipping this flag would send
   every midnight-hour write twelve hours wrong, silently, with a green
   typecheck. The twelve-hour clock lives in formatCairo, below. */
function wallClockParts(instant: Date) {
  wallClockFmt ??= new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = wallClockFmt.formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), hh: get("hour") % 24, mm: get("minute") };
}

/** UTC instant → Cairo-local { date: "YYYY-MM-DD", time: "HH:mm" } for form inputs. */
export function utcToCairo(instant: Date): { date: string; time: string } {
  const { y, m, d, hh, mm } = wallClockParts(instant);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${y}-${pad(m)}-${pad(d)}`, time: `${pad(hh)}:${pad(mm)}` };
}

/** The first UTC instant that falls on a given Cairo calendar date.

    Egypt's spring-forward jumps AT midnight, so 00:00 may not exist on the
    transition day — the solver then lands on 23:00 of the EVE, silently
    stealing the eve's last hour into the next day's window. Clamp to the first
    instant that actually falls on the requested date (the post-jump 01:00; DST
    jumps are one hour).

    Lived privately in services/todo.ts until ADR-071 needed the identical clamp
    for the calendar's month window. One copy, so a second reader cannot drift
    from the first. */
export function startOfCairoDay(date: string): Date {
  let start = cairoToUtc(date, "00:00");
  if (utcToCairo(start).date !== date) start = new Date(start.getTime() + 60 * 60 * 1000);
  return start;
}

/** Do two UTC instants fall on the same CAIRO calendar day? The comparison
    goes through utcToCairo — never a local-timezone Date part — so it stays
    right on the machine of a viewer anywhere in the world and across Egypt's
    DST jumps. (Used by the boards' Today chip, ADR-061.) */
export function sameCairoDay(a: Date, b: Date): boolean {
  return utcToCairo(a).date === utcToCairo(b).date;
}

/* ---------------------------------------------- the DISPLAY layer (ADR-068) */

/* Founder: "use the twelve hour timing, not the twenty four hour timing. And
   this is through the entire system." One formatter owns every clock a person
   reads, so "the entire system" is a property of this file rather than a
   promise about call sites.

   THE LOCALE IS A REQUIRED ARGUMENT, never an optional one with a default.
   An optional locale would let a forgotten argument compile and quietly print
   an English AM/PM inside an Arabic page — the exact drift ADR-066 §8 closed
   for EntitySwitch by making its `user` prop required. Required turns "find
   every call site" into a list of compiler errors.

   ARABIC IS RENDERED IN ARABIC, with LATIN digits (`-u-nu-latn`, the house
   convention already set by LeadChat and money.ts) and CLDR's own morning /
   evening markers ص (صباحًا) and م (مساءً) — never a latin AM/PM. This is not
   decoration: a "20 Aug 2026, 6:30 م" would be a bidi-mixed string, and the
   Unicode bidi algorithm renders it in an RTL paragraph as "م 20 Aug 2026,
   6:30" — the marker torn off the time and parked against the date. The
   formatted value is frequently concatenated INTO a longer sentence before it
   reaches the DOM ("Next: …", "Due … · Call"), so no CSS isolate at the call
   site could fix it. A natively Arabic string has no mixed run to reorder. */
const localeTag = (locale: Locale) => (locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB");

/* ONE cached formatter per shape, for the same reason wallClockParts caches:
   constructing an Intl.DateTimeFormat is the expensive part and the boards
   render one per card. */
const displayFmts = new Map<string, Intl.DateTimeFormat>();

function displayFmt(
  locale: Locale,
  opts: Intl.DateTimeFormatOptions,
  key: string,
): Intl.DateTimeFormat {
  const cacheKey = `${locale}|${key}`;
  let fmt = displayFmts.get(cacheKey);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(localeTag(locale), { timeZone: TIME_ZONE, ...opts });
    displayFmts.set(cacheKey, fmt);
  }
  return fmt;
}

/* Assembled from parts, not from .format(), for two reasons that are both
   about not breaking later: ICU ≥ 72 emits U+202F (NARROW NO-BREAK SPACE)
   before the day period in several locale/version pairs, so a Node upgrade
   would otherwise turn every "2:30 PM" assertion in the suite red with no code
   change; and en-GB's own marker is lowercase "pm", which nobody writes on a
   screen. */
function render(fmt: Intl.DateTimeFormat, instant: Date, locale: Locale): string {
  const parts = fmt.formatToParts(instant);
  return parts
    .map((p, i) => {
      if (p.type === "dayPeriod") return locale === "en" ? p.value.toUpperCase() : p.value;
      if (p.type === "literal" && parts[i + 1]?.type === "dayPeriod") return " ";
      return p.value;
    })
    .join("");
}

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
};
const TIME_OPTS: Intl.DateTimeFormatOptions = {
  /* "numeric", not "2-digit": with hour12 a 2-digit hour reads "02:30 PM",
     which is not how a twelve-hour clock is written. */
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

/** Human rendering in Cairo time — "8 Aug 2026, 2:30 PM" / "8 أغسطس 2026، 2:30 م". */
export function formatCairo(
  instant: Date | null | undefined,
  locale: Locale,
  withTime = true,
): string {
  if (!instant) return "—";
  const opts = withTime ? { ...DATE_OPTS, ...TIME_OPTS } : DATE_OPTS;
  return render(displayFmt(locale, opts, withTime ? "dt" : "d"), instant, locale);
}

/** Date with no clock — "8 Aug 2026" / "8 أغسطس 2026". Records whose instant is
    a DAY (statements, milestones, a follow-up whose time nobody chose — ADR-063)
    render through here, and must never grow a "2:00 AM" out of a UTC midnight. */
export function formatCairoDate(instant: Date | null | undefined, locale: Locale): string {
  return formatCairo(instant, locale, false);
}

/** The clock ALONE — "2:30 PM" / "2:30 م". The calendar's chips (ADR-071) sit
    in a cell that already states its date, so repeating it would spend the only
    horizontal room the chip has on something the reader can see above it.
    Routed through the same `render`, so it is the same twelve-hour clock as
    every other time in the product rather than a second one. */
export function formatCairoTime(instant: Date, locale: Locale): string {
  return render(displayFmt(locale, TIME_OPTS, "t"), instant, locale);
}

/** Month and year — "August 2026" / "أغسطس 2026". The calendar's title. */
export function formatCairoMonth(instant: Date, locale: Locale): string {
  return render(displayFmt(locale, { month: "long", year: "numeric" }, "my"), instant, locale);
}

/** The short stamp the lead chat wants — day, month, clock; no year. Lives here
    so there is exactly ONE clock in the product: the chat used to build its own
    Intl formatter and, having never set hour12, printed 24-hour in English and
    12-hour in Arabic — one component with two answers. */
export function formatCairoShort(instant: Date, locale: Locale): string {
  return render(
    displayFmt(locale, { day: "numeric", month: "short", ...TIME_OPTS }, "short"),
    instant,
    locale,
  );
}

/* Store UTC, display Africa/Cairo (SPEC §2). This module owns every combine/split
   between the UI's Cairo-local date+time inputs (§6.2 shape) and the single stored
   UTC instant — DST-safe via Intl, no fixed offsets. */

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

function wallClockParts(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), hh: get("hour") % 24, mm: get("minute") };
}

/** UTC instant → Cairo-local { date: "YYYY-MM-DD", time: "HH:mm" } for form inputs. */
export function utcToCairo(instant: Date): { date: string; time: string } {
  const { y, m, d, hh, mm } = wallClockParts(instant);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${y}-${pad(m)}-${pad(d)}`, time: `${pad(hh)}:${pad(mm)}` };
}

/** Human rendering in Cairo time, e.g. "8 Aug 2026, 14:30". */
export function formatCairo(instant: Date | null | undefined, withTime = true): string {
  if (!instant) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).format(instant);
}

export function formatCairoDate(instant: Date | null | undefined): string {
  return formatCairo(instant, false);
}

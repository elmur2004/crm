import { utcToCairo } from "@/lib/datetime";

/* The accounting engine is pure — every "this month" is a parameter. These are
   the ONLY places the wall clock enters the module (Africa/Cairo, SPEC §2). */

/** today's Cairo-local calendar date, "YYYY-MM-DD" */
export function cairoToday(): string {
  return utcToCairo(new Date()).date;
}

/** the current Cairo-local month, "YYYY-MM" — the SPA's thisMonth() */
export function cairoMonth(): string {
  return cairoToday().slice(0, 7);
}

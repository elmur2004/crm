import { utcToCairo } from "@/lib/datetime";

/* ADR-053 — was this task late, and by how many whole days?

   Mirrors the reference app's lateness.ts EXACTLY, re-expressed over the
   module's "YYYY-MM-DD" deadline strings (ADR-052's calendar-string precedent):
   the deadline is a calendar date evaluated in Africa/Cairo, and a task is late
   when it completes after 23:59:59 Cairo time on that date. Completing ON the
   deadline day is on time — the generous reading, deliberately, because this
   number becomes a performance record about a named person.

   Called exactly once per task, at completion, and the result is STORED. There
   is no recompute path anywhere: editing the deadline later must not rewrite
   history (the reference AC-12). Pure arithmetic — unit-tested directly. */

export type Lateness = { wasLate: boolean; daysLate: number };

const DAY_MS = 24 * 60 * 60 * 1000;

function utcMidnight(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

export function computeLateness(
  /** "YYYY-MM-DD" — the task's calendar-date deadline. */
  deadline: string,
  /** Server time at the moment of completion (reference BR-06 — never the browser). */
  completedAt: Date,
): Lateness {
  // The completion instant, expressed as a Cairo calendar date (DST-safe Intl).
  const completedCairo = utcToCairo(completedAt).date;
  const daysLate = Math.max(
    0,
    Math.round((utcMidnight(completedCairo) - utcMidnight(deadline)) / DAY_MS),
  );
  return { wasLate: daysLate > 0, daysLate };
}

/** Live "overdue" for an OPEN task: today in Cairo is past the deadline date.
    Distinct from the frozen wasLate of a completed task — one is a live
    warning, the other is history. Never conflate them (reference FR-T09). */
export function isOverdue(deadline: string, now = new Date()): boolean {
  return utcToCairo(now).date > deadline; // ISO strings compare lexicographically
}

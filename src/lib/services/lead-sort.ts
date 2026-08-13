/* Founder (leads list ordering): "last edited, last added, and
   closer-to-the-finish of the pipeline = higher priority". Pure helpers —
   applied in JS after the brand-scoped fetch (the lists are page-sized). */

export type LeadSort = "added" | "updated" | "priority";

export const LEAD_SORTS: readonly LeadSort[] = ["added", "updated", "priority"] as const;

/* Deeper in the pipeline = higher priority; the terminal stages close the
   list. Unknown stages sink to the bottom (defensive — the engine owns the
   stage sets). */
const STAGE_RANK: Record<string, number> = {
  negotiation: 0,
  sending_proposal: 1,
  meeting_setting: 2,
  following_up: 3,
  new: 4,
  won: 5,
  lost: 6,
};

export function stagePriority(stage: string): number {
  return STAGE_RANK[stage] ?? 99;
}

export function sortLeads<T extends { stage: string; createdAt: Date; updatedAt: Date }>(
  leads: T[],
  sort: LeadSort,
): T[] {
  const copy = [...leads];
  if (sort === "added") {
    copy.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } else if (sort === "updated") {
    copy.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  } else {
    copy.sort(
      (a, b) =>
        stagePriority(a.stage) - stagePriority(b.stage) ||
        b.updatedAt.getTime() - a.updatedAt.getTime(),
    );
  }
  return copy;
}

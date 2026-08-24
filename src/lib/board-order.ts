/* Founder (ADR-064): "the column of meeting setting should be in time order
   always in order of these meetings taking place".

   Every board column is ordered `updatedAt desc` — most recently touched first
   — which is right for a queue of work but wrong for a column of APPOINTMENTS:
   the founder reads that column as a diary, so it must run soonest-first, and
   "always" means the order is a property of the column, not a toggle.

   This is deliberately a PURE function over the already-built card list rather
   than a second `orderBy` in Prisma: the meeting instant lives on a child row
   (`Meeting.datetime`, latest record wins) and only for cards in that one
   stage, which no single relational sort can express without re-ordering the
   other five columns too. The boards build their cards server-side, so this
   runs server-side with them — the client receives cards already in order.

   Nothing else moves. The meeting cards are sorted AMONG THEMSELVES and put
   back in the slots they already occupied, so every other column keeps its
   `updatedAt desc` order byte for byte. */

/** The two fields the ordering needs. Every board card already carries `stage`;
    `meetingAt` is the instant that card DISPLAYS (see the boards' keyDatum). */
export interface MeetingOrderable {
  stage: string;
  /** ISO instant of the meeting this card shows — null when none is set */
  meetingAt: string | null;
}

/* A card with no meeting instant sorts LAST rather than vanishing or throwing:
   "Meeting not arranged" is a real, common state of that column (an unarranged
   record, or none at all), and those cards are exactly the ones still owing a
   decision — they belong under the diary, not scattered through it. An
   unparseable string is treated the same way, so bad data degrades to "last"
   instead of poisoning the comparator with NaN. */
const LAST = Number.POSITIVE_INFINITY;

export function meetingSortKey(at: string | null): number {
  if (!at) return LAST;
  const t = Date.parse(at);
  return Number.isNaN(t) ? LAST : t;
}

/** Soonest meeting first within `meetingStage`; every other card untouched.
    Ties (and the datetime-less tail) keep their incoming relative order —
    Array.prototype.sort is stable, so the fallback stays `updatedAt desc`. */
export function orderMeetingColumn<T extends MeetingOrderable>(
  cards: T[],
  meetingStage: string,
): T[] {
  const slots: number[] = [];
  for (let i = 0; i < cards.length; i += 1) {
    if (cards[i].stage === meetingStage) slots.push(i);
  }
  if (slots.length < 2) return cards; // nothing to order
  const ordered = slots
    .map((i) => cards[i])
    .sort((a, b) => {
      const ka = meetingSortKey(a.meetingAt);
      const kb = meetingSortKey(b.meetingAt);
      /* never `ka - kb`: Infinity - Infinity is NaN, which would make two
         datetime-less cards compare as "unordered" and corrupt the sort */
      if (ka === kb) return 0;
      return ka < kb ? -1 : 1;
    });
  const out = cards.slice();
  slots.forEach((slot, n) => {
    out[slot] = ordered[n];
  });
  return out;
}

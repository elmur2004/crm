/* ============================================================================
   THE LIVE RECORD — ONE DEFINITION, FOR EVERY SURFACE THAT SHOWS ONE.

   A lead's stage says what KIND of work is outstanding; its records say what
   that work is. The two can disagree, because a stage move does not always
   write a record: B-6 / T-5 returns a lead to Following Up with NO follow-up
   form for an agent or a partner (V2 section 3 — the light roles are asked for
   nothing), and T-8 can land a cancelled meeting back in Following Up. The
   lead's newest FOLLOW-UP is then a leftover from before the proposal, and it
   is not a promise anybody made.

   So every surface that prints "the lead's next follow-up" asks the same
   question: is that follow-up the lead's NEWEST RECORD, across follow-ups,
   meetings, proposals and negotiation notes? The To-Do (ADR-041/062) has asked
   it since it was written; its completion marks (todo-done.ts) ask it to decide
   what may be ticked; and since ADR-082 the BOARDS have to ask it too, because
   a stale date now decides which COLUMN a card lives in — and "Fallen behind"
   is a red column that refuses drops and tells him to re-date something he
   never dated.

   It lived in three places with three copies of the Math.max. One copy now, so
   a fourth reader cannot drift from the first and the three existing ones
   cannot drift from each other.

   `negotiationNotes` is OPTIONAL: the ByteForce pipeline has no negotiation
   stage, so a caller reading that board may legitimately not fetch them. A
   MISSING list and an EMPTY list mean the same thing here — nothing newer —
   which is why this is an optional field rather than a second function.
   ========================================================================== */

export interface LeadRecordTimes {
  followUps: { createdAt: Date }[];
  meetings: { createdAt: Date }[];
  proposals: { createdAt: Date }[];
  negotiationNotes?: { createdAt: Date }[];
}

/** The `createdAt` of the lead's newest record, as a timestamp. 0 when it has
    none — which no real record can equal, so `isNewestRecord` stays false for a
    lead with nothing rather than true for everything. */
export function newestRecordAt(lead: LeadRecordTimes): number {
  return Math.max(
    lead.followUps[0]?.createdAt.getTime() ?? 0,
    lead.meetings[0]?.createdAt.getTime() ?? 0,
    lead.proposals[0]?.createdAt.getTime() ?? 0,
    lead.negotiationNotes?.[0]?.createdAt.getTime() ?? 0,
  );
}

/** Is `record` the lead's newest record? `null`/`undefined` is not — a lead with
    no follow-up has no live one, which is the answer every caller wants.

    The lists are each the lead's own newest of that kind (`orderBy createdAt
    desc, take 1`), so this is an equality against a maximum rather than a
    search. Equality, not `>=`: the record either IS the newest or it is
    history. */
export function isNewestRecord(
  record: { createdAt: Date } | null | undefined,
  lead: LeadRecordTimes,
): boolean {
  return !!record && record.createdAt.getTime() === newestRecordAt(lead);
}

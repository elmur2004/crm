import { utcToCairo } from "@/lib/datetime";

/* ============================================================================
   ADR-082 — "FALLEN BEHIND" IS A DERIVED SPLIT OF Following Up, NOT A STAGE.

   The founder, verbatim: "the follow up column should just contain current or
   future dates any fallen behind dates should be in a separate column called
   fallen behind".

   THE DECISION, AND THE ONE REASON THAT SETTLES IT. The lead's stage stays
   `following_up`; the board draws TWO columns out of it and decides which by
   the live follow-up's due date. The cheap reasons are real — no migration, no
   SPEC §10 rows, no drag rules of its own, nothing that keys on stage moves —
   but the decisive one is that a derived column MAINTAINS ITSELF AS DAYS PASS.
   A real stage would need somebody to drag every card across the board the
   morning it aged, which is the exact work the column exists to remove. Nothing
   in this product moves a card because a clock ticked, and nothing should.

   WHAT FOLLOWS FROM IT, and it is the whole contract of this module:

     · NOTHING CAN BE DROPPED IN. `FALLEN_BEHIND_COLUMN` is not a stage id, so
       it is not a transition target and the boards refuse the drop and say so
       the way they already say the Won column is closed. It is a date
       condition; the way a lead leaves it is by being given a new date (the
       existing "Log another follow-up"), and then it moves itself.

     · A CARD CAN BE DRAGGED OUT to anywhere `following_up` already allows,
       behaving exactly as it would from Following Up — because its stage IS
       `following_up`. There is no second code path to keep in step.

     · A LEAD WITH NO FOLLOW-UP AT ALL STAYS IN FOLLOWING UP. "Fallen behind"
       means a date has passed; a lead with no date has nothing that could have
       passed. It is owing a date, not overdue — its card already prints "No
       follow-up set", which is work for today, and today's work belongs in the
       column he actually works out of. Filing it under a column he has told us
       he will only revisit to re-date things would bury the one card whose
       problem is that it has no date to re-date.

   THE DAY IS A CAIRO DAY, read through `utcToCairo` day-strings — never a
   local-timezone Date, and never a comparison of instants (`dueAt < now` calls
   a follow-up due at 09:00 today "behind" by 09:01). The two inputs are both
   day-strings, so the comparison is a plain lexicographic one, which is also a
   chronological one for ISO dates.
   ========================================================================== */

/** The derived column's id. Deliberately NOT a stage name and deliberately not
    in any config's `stages`: nothing may mistake it for a transition target. */
export const FALLEN_BEHIND_COLUMN = "fallen_behind";

/** The `data-stage-key` the column paints with (stageColors maps it). */
export const FALLEN_BEHIND_STAGE_KEY = "fallen-behind";

/** Is this follow-up instant BEHIND the given Cairo day?

    `null` (no follow-up at all) is NOT behind — see the module header. */
export function isFallenBehind(dueAtIso: string | null, todayCairoDate: string): boolean {
  if (!dueAtIso) return false;
  const due = new Date(dueAtIso);
  if (Number.isNaN(due.getTime())) return false; // an unparseable instant is not a verdict
  return utcToCairo(due).date < todayCairoDate;
}

/** Which of the two columns a FOLLOWING-UP card belongs to. Cards in any other
    stage are untouched — the split exists only inside one stage. */
export function columnFor(
  card: { stage: string; followUpDueAt: string | null },
  /** `null` is a pipeline with NO follow-up stage (the slot shape every config
      option uses) — it gets no split, by construction rather than by a caller
      remembering to check. */
  followUpStage: string | null,
  todayCairoDate: string,
): string {
  return followUpStage !== null &&
    card.stage === followUpStage &&
    isFallenBehind(card.followUpDueAt, todayCairoDate)
    ? FALLEN_BEHIND_COLUMN
    : card.stage;
}

/** The COLUMN a just-committed drop actually put the card in.

    ADR-082 (review) — the drop's TARGET is a stage; the column is DERIVED. A
    drop on Following Up carrying a follow-up date that has already passed
    therefore lands two columns away, under "Fallen behind" — and the board said
    NOTHING about it: `commitDrop` refreshed, the card appeared somewhere he was
    not looking, and the column it appeared in says "Not a drop target". The
    placement is right (the date really has passed); the silence was the defect,
    and it is the same failure the `landedHere` machinery exists to prevent.

    Both inputs are Cairo DAY-STRINGS, so the comparison is a plain
    lexicographic one — which for ISO dates is also a chronological one, the
    same property `isFallenBehind` relies on. A `null` day (the first paint,
    before the Cairo day is known) answers the TARGET: never a guess.

    It takes the SUBMITTED date rather than a stored instant because it runs
    before the refresh — the row it describes may not have been read back yet. */
export function landingColumn(
  toStage: string,
  /** the "YYYY-MM-DD" the drop's follow-up group carried, if any */
  followUpDate: string | null,
  followUpStage: string | null,
  todayCairoDate: string | null,
): string {
  return followUpStage !== null &&
    toStage === followUpStage &&
    todayCairoDate !== null &&
    followUpDate !== null &&
    followUpDate < todayCairoDate
    ? FALLEN_BEHIND_COLUMN
    : toStage;
}

/** The follow-up date a drop's payload carries, read off the wire shape both
    boards post (`{ event, group: { group, data } }`). `null` for every drop
    that carries no follow-up group, which is most of them — and for a group
    whose date is missing or is not a string, because a guess here would move a
    card's column on the strength of a malformed payload. */
export function followUpDateOfDrop(body: unknown): string | null {
  const group = (body as { group?: { group?: string; data?: { date?: unknown } } } | null)?.group;
  if (!group || group.group !== "follow_up") return null;
  const date = group.data?.date;
  return typeof date === "string" && date !== "" ? date : null;
}

/** The board's column list: the pipeline's stages with the derived column
    inserted immediately BEFORE the follow-up stage.

    Before, not after: he reads the board left to right as a funnel, and the
    cards he is late on are the ones he wants to see before the ones he is on
    time for. (Right-to-left in Arabic — the board is a flex row that mirrors,
    so "before" means "first" in both.) */
export function boardColumns(
  stages: readonly string[],
  followUpStage: string | null,
): string[] {
  if (followUpStage === null) return [...stages];
  const at = stages.indexOf(followUpStage);
  if (at < 0) return [...stages]; // a pipeline with no follow-up stage gets nothing
  return [...stages.slice(0, at), FALLEN_BEHIND_COLUMN, ...stages.slice(at)];
}

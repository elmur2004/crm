import { describe, expect, it } from "vitest";
import {
  FALLEN_BEHIND_COLUMN,
  FALLEN_BEHIND_STAGE_KEY,
  boardColumns,
  columnFor,
  isFallenBehind,
} from "./fallen-behind";
import { cairoToUtc } from "@/lib/datetime";
import { BSYSTEMS_STAGES, INTERNAL_STAGES, PROSPECT_STAGES } from "@/lib/pipeline-engine/constants";
import { bsystemsCrmConfig } from "@/lib/pipeline-engine/configs/bsystems-crm";
import { internalCrmConfig } from "@/lib/pipeline-engine/configs/internal-crm";
import { agentsConfig, partnersConfig } from "@/lib/pipeline-engine/configs/partners";
import { stageKey } from "@/components/bsystems/stageColors";

/* ============================================================================
   ADR-082 — the founder: "the follow up column should just contain current or
   future dates any fallen behind dates should be in a separate column called
   fallen behind".

   The split is DERIVED, so this is the whole of its logic and it is pure. Three
   properties carry the feature, and each one is a thing that would otherwise be
   silently wrong:

     1. THE BOUNDARY. Today is NOT behind. A follow-up due at 09:00 this morning
        is this morning's work, not a failure — a `dueAt < now` comparison calls
        it behind at 09:01 and would move the card out from under him mid-call.
     2. CAIRO DAYS, NOT INSTANTS. Read through utcToCairo, so a viewer in any
        timezone sees the same split and Egypt's DST days cannot shift it.
     3. NOTHING ELSE MOVES. The split lives inside one stage; every other stage's
        cards keep their column, and no pipeline gains a stage.
   ========================================================================== */

const TODAY = "2026-11-10";
const iso = (date: string, time = "09:00") => cairoToUtc(date, time).toISOString();

describe("isFallenBehind — the boundary is the DAY, and today is not behind", () => {
  it("YESTERDAY and earlier are behind", () => {
    expect(isFallenBehind(iso("2026-11-09"), TODAY)).toBe(true);
    expect(isFallenBehind(iso("2026-01-02"), TODAY)).toBe(true);
    expect(isFallenBehind(iso("2025-12-31"), TODAY)).toBe(true);
  });

  it("TODAY is not behind, at any hour of it", () => {
    /* The one that matters most: a 09:00 follow-up is not a failure at 09:01.
       Every hour of the Cairo day, including the two ends. */
    for (const time of ["00:01", "08:59", "09:00", "12:00", "17:30", "23:59"]) {
      expect(isFallenBehind(iso(TODAY, time), TODAY), time).toBe(false);
    }
  });

  it("TOMORROW and later are not behind", () => {
    expect(isFallenBehind(iso("2026-11-11"), TODAY)).toBe(false);
    expect(isFallenBehind(iso("2027-03-01"), TODAY)).toBe(false);
  });

  it("NO follow-up at all is not behind — the founder-facing decision", () => {
    /* "Fallen behind" means a date has passed; a lead with no date has nothing
       that could have passed. It is owing a date, not overdue — and its card
       already says "No follow-up set", which is work for TODAY. Burying it in
       the column he will only revisit to re-date things would hide the one card
       whose problem is that it has no date to re-date. */
    expect(isFallenBehind(null, TODAY)).toBe(false);
  });

  it("an unparseable instant is not a verdict either", () => {
    /* Same discipline as ADR-064's meeting sort, which refuses to let a NaN
       poison a comparator: garbage must not silently re-file a card. */
    expect(isFallenBehind("not-a-date", TODAY)).toBe(false);
    expect(isFallenBehind("", TODAY)).toBe(false);
  });

  it("the CAIRO day decides, not the UTC one", () => {
    /* 00:30 Cairo on the 10th is 22:30 UTC on the 9th. Read off the UTC date it
       would be "behind"; read as a Cairo day it is today — which is what the
       person looking at the board means. */
    const earlyCairo = cairoToUtc(TODAY, "00:30");
    expect(earlyCairo.toISOString().slice(0, 10)).toBe("2026-11-09");
    expect(isFallenBehind(earlyCairo.toISOString(), TODAY)).toBe(false);
  });

  it("Egypt's DST transition days split the same as any other day", () => {
    for (const day of ["2026-04-24", "2026-10-30"]) {
      expect(isFallenBehind(iso(day, "09:00"), day)).toBe(false);
      expect(isFallenBehind(iso(day, "09:00"), "2026-12-01")).toBe(true);
    }
  });
});

describe("columnFor — the split lives inside ONE stage", () => {
  const card = (stage: string, followUpDueAt: string | null) => ({ stage, followUpDueAt });

  it("an overdue FOLLOWING-UP card moves to the derived column", () => {
    expect(columnFor(card("following_up", iso("2026-11-01")), "following_up", TODAY)).toBe(
      FALLEN_BEHIND_COLUMN,
    );
  });

  it("a current or future one stays in Following Up", () => {
    expect(columnFor(card("following_up", iso(TODAY)), "following_up", TODAY)).toBe("following_up");
    expect(columnFor(card("following_up", iso("2026-12-25")), "following_up", TODAY)).toBe(
      "following_up",
    );
  });

  it("a following-up card with NO follow-up stays in Following Up", () => {
    expect(columnFor(card("following_up", null), "following_up", TODAY)).toBe("following_up");
  });

  it("NO OTHER STAGE is touched, even carrying an overdue instant", () => {
    /* The boards only set `followUpDueAt` on Following Up cards, but the
       function must not depend on that: a negotiation response date is also a
       follow-up row, and the negotiation column is not the one he split. */
    for (const stage of [
      "new",
      "meeting_setting",
      "sending_proposal",
      "negotiation",
      "postponed",
      "won",
      "lost",
    ]) {
      expect(columnFor(card(stage, iso("2026-01-01")), "following_up", TODAY), stage).toBe(stage);
    }
  });

  it("a pipeline with NO follow-up stage gets no split at all", () => {
    expect(columnFor(card("contacted", iso("2026-01-01")), null, TODAY)).toBe("contacted");
  });
});

describe("boardColumns — one extra COLUMN, and not one extra stage", () => {
  it("inserts Fallen behind immediately before Following Up on both lead boards", () => {
    for (const [stages, config] of [
      [INTERNAL_STAGES, internalCrmConfig],
      [BSYSTEMS_STAGES, bsystemsCrmConfig],
    ] as const) {
      const cols = boardColumns(stages, config.followUpStage);
      expect(cols).toHaveLength(stages.length + 1);
      const at = cols.indexOf(FALLEN_BEHIND_COLUMN);
      expect(at).toBeGreaterThanOrEqual(0);
      expect(cols[at + 1]).toBe(config.followUpStage);
      /* every stage keeps its order relative to every other stage */
      expect(cols.filter((c) => c !== FALLEN_BEHIND_COLUMN)).toEqual([...stages]);
    }
  });

  it("the PARTNER/AGENT funnel gets NOTHING — it has had no follow-up stage since ADR-059", () => {
    /* Follow-ups there are records written from any active stage (PP-8), so
       there is no column to split. Asserted in both directions, like ADR-072's
       own funnel guard. */
    for (const config of [partnersConfig, agentsConfig]) {
      expect(config.followUpStage).toBeNull();
      expect(boardColumns(PROSPECT_STAGES, config.followUpStage)).toEqual([...PROSPECT_STAGES]);
      expect(boardColumns(config.stages, config.followUpStage)).not.toContain(
        FALLEN_BEHIND_COLUMN,
      );
    }
  });

  it("the column id is NOT a stage in any pipeline — nothing can target it", () => {
    for (const config of [internalCrmConfig, bsystemsCrmConfig, partnersConfig, agentsConfig]) {
      expect(config.stages).not.toContain(FALLEN_BEHIND_COLUMN);
      expect(config.terminalStages).not.toContain(FALLEN_BEHIND_COLUMN);
      expect(config.nextActions("following_up", "bsystems_admin")).not.toContain(
        FALLEN_BEHIND_COLUMN,
      );
    }
  });
});

describe("it has its own colour key, in every scope", () => {
  it("stageKey maps the column to its own key and never falls through to Lost", () => {
    /* `stageKey`'s default is "lost": a column left out of it is painted in the
       colour of a dead lead, silently, and every guard stays green. */
    expect(stageKey(FALLEN_BEHIND_COLUMN)).toBe(FALLEN_BEHIND_STAGE_KEY);
    expect(stageKey(FALLEN_BEHIND_COLUMN)).not.toBe("lost");
    expect(stageKey(FALLEN_BEHIND_COLUMN)).not.toBe("following");
  });
});

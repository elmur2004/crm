import { describe, expect, it } from "vitest";
import { LOCALES } from "./core";
import {
  dailyReport,
  interactionPhrase,
  isGenericPhrase,
  type InteractionRow,
} from "./dict/daily-report";
import { LOG_ACTIONS } from "@/lib/pipeline-engine/constants";
import { stageMsgs } from "./dict/labels";
import { history } from "./dict/internal";

/* ============================================================================
   ADR-081 — THE PHRASE MAP IS COMPLETE, AND CANNOT CRASH.

   Two failures this test exists for, both of which this product has already had:

   1. A MISSING KEY IS A WHITE SCREEN. `tFor` has no fallback by design and the
      map is keyed on `trigger`, which the compiler cannot check, so a new engine
      row reaching `t(undefined)` throws during render — the ADR-075 crash that
      reached the founder as "I can't add any users in bsystems right now".

   2. A ROW THE REPORT CANNOT PHRASE MUST STILL COUNT. Dropping it would change
      the headline number he asked for twice, silently. So the resolver falls back
      to a generic verb, and THIS test is what stops the generic becoming the
      normal answer: every trigger the product can actually stamp on a lead must
      resolve to a SPECIFIC phrase, in both languages.

   The inventory below is written out rather than imported because the engine's
   trigger ids are computed inside `triggerForAction` / `outcomeTrigger` and are
   not exported as a set. Each entry names where it is stamped, so the list is
   auditable against the services rather than trusted.
   ========================================================================== */

function mk(
  action: string,
  trigger: string,
  fromStage: string | null = null,
  toStage: string | null = null,
): InteractionRow {
  return { action, trigger, fromStage, toStage };
}
const move = (trigger: string, from: string, to: string) => mk("stage_change", trigger, from, to);
const auto = (trigger: string, from: string, to: string) => mk("auto_transfer", trigger, from, to);
const group = (trigger: string) => mk("group_added", trigger);

/** Every lead-touching trigger, with the ROW SHAPE the product really writes. */
const INVENTORY: Array<{ why: string; row: InteractionRow }> = [
  /* ---- services/leads.ts, the flat triggers */
  { why: "leads.ts:105 create", row: mk("create", "create", null, "new") },
  { why: "leads.ts:105 partner attribution", row: mk("create", "PP-5", null, "new") },
  { why: "leads.ts:150 ready to close", row: mk("update", "B-RTC") },
  { why: "leads.ts:224 didn't answer", row: mk("update", "no_answer") },
  { why: "leads.ts:224 answered", row: mk("update", "no_answer_cleared") },
  { why: "leads.ts:734 auto-clear inside a move", row: mk("update", "no_answer_cleared") },
  { why: "leads.ts:286 archive", row: mk("update", "archived") },
  { why: "leads.ts:286 unarchive", row: mk("update", "unarchived") },
  { why: "leads.ts:377 assign owner", row: mk("update", "assigned") },
  { why: "leads.ts:445 delete", row: mk("update", "deleted") },
  { why: "leads.ts:490 edit fields", row: mk("update", "edit") },
  { why: "comments.ts:159 the lead chat", row: mk("comment", "lead_chat") },
  { why: "whatsapp.ts:87 the WhatsApp mark", row: mk("update", "whatsapp_sent") },
  { why: "proposals.ts:77 proposal corrected", row: mk("update", "proposal_edited") },
  { why: "users.ts:335 owner account deleted", row: mk("update", "owner_deleted") },
  { why: "undo.ts:268 undo", row: mk("update", "undo") },

  /* ---- the ByteForce / internal pipeline (transition.ts triggerForAction) */
  { why: "T-1 following up", row: move("T-1", "new", "following_up") },
  { why: "T-2 meeting setting", row: move("T-2", "following_up", "meeting_setting") },
  { why: "T-3 sending proposal", row: move("T-3", "meeting_setting", "sending_proposal") },
  { why: "T-4 lost", row: move("T-4", "following_up", "lost") },
  { why: "T-9 won", row: move("T-9", "sending_proposal", "won") },
  { why: "T-0 the generic internal move", row: move("T-0", "following_up", "new") },
  { why: "T-0 postpone (ADR-072)", row: move("T-0", "following_up", "postponed") },
  { why: "T-5 the automatic proposal-sent return", row: auto("T-5", "sending_proposal", "following_up") },
  /* the ATTENDED branch of `meeting_outcome` returns `auto: true`, so the row the
     product really writes is an `auto_transfer` — and T-6 is reachable NO other
     way (`triggerForAction` never returns it). Review, Run 097: the first draft
     of this inventory listed it as a `stage_change` and so never saw the phrase
     the screen actually printed. */
  { why: "T-6 meeting attended (auto row, destination chosen by him)", row: auto("T-6", "meeting_setting", "sending_proposal") },
  { why: "T-7 meeting delayed (same stage)", row: move("T-7", "meeting_setting", "meeting_setting") },
  { why: "T-8 meeting cancelled", row: move("T-8", "meeting_setting", "following_up") },

  /* ---- the B-Systems pipeline */
  { why: "B-1 the generic move", row: move("B-1", "new", "following_up") },
  { why: "B-1 postpone (ADR-072)", row: move("B-1", "following_up", "postponed") },
  { why: "B-4 negotiation", row: move("B-4", "sending_proposal", "negotiation") },
  { why: "B-9 won", row: move("B-9", "negotiation", "won") },
  { why: "B-6 the automatic proposal-sent return", row: auto("B-6", "sending_proposal", "following_up") },
  { why: "B-7 meeting delayed (same stage)", row: move("B-7", "meeting_setting", "meeting_setting") },
  { why: "B-7 meeting cancelled", row: move("B-7", "meeting_setting", "following_up") },
  { why: "B-7 meeting attended (auto row)", row: auto("B-7", "meeting_setting", "sending_proposal") },
  { why: "B-9 attended → won (auto row)", row: auto("B-9", "meeting_setting", "won") },

  /* ---- the same-stage records (SAME_STAGE_TRIGGERS), action `group_added` */
  { why: "FU-AGAIN another follow-up", row: group("FU-AGAIN") },
  { why: "NEG-DUE the response date", row: group("NEG-DUE") },
  { why: "MTG-RESCHEDULE a new meeting", row: group("MTG-RESCHEDULE") },
];

describe("ADR-081 — every interaction the product records has a phrase, in both languages", () => {
  it("the inventory is real (a silent zero would prove nothing)", () => {
    expect(INVENTORY.length).toBeGreaterThanOrEqual(35);
  });

  it.each(INVENTORY.map((e) => [`${e.why} [${e.row.trigger}]`, e.row] as const))(
    "%s reads as a SPECIFIC phrase in English and in Arabic",
    (_label, row) => {
      for (const locale of LOCALES) {
        const phrase = interactionPhrase(locale, row);
        expect(phrase, `${locale} phrase for ${row.trigger}`).toBeTruthy();
        expect(phrase.trim().length).toBeGreaterThan(1);
        expect(
          isGenericPhrase(locale, phrase),
          `${row.trigger} fell through to the generic "worked on this lead" in ${locale} — ` +
            "give it a phrase in dict/daily-report.ts (ADR-081)",
        ).toBe(false);
      }
    },
  );

  it("a MOVE is phrased from its destination stage, not from its row id", () => {
    expect(interactionPhrase("en", move("B-1", "new", "following_up"))).toBe(
      "Moved to Following Up",
    );
    expect(interactionPhrase("ar", move("B-1", "new", "following_up"))).toBe("انتقل إلى متابعة");
    /* which is exactly what makes a row id this build has never heard of read
       correctly the day SPEC §10 grows one */
    expect(interactionPhrase("en", move("B-12", "new", "negotiation"))).toBe("Moved to Negotiation");
    expect(interactionPhrase("en", move("Z-99", "new", "postponed"))).toBe(
      "Moved to Postpone / Not answering",
    );
  });

  it("an AUTOMATIC move is not claimed as a click", () => {
    expect(interactionPhrase("en", auto("B-6", "sending_proposal", "following_up"))).toBe(
      "Moved automatically to Following Up",
    );
    expect(interactionPhrase("en", auto("T-5", "sending_proposal", "following_up"))).toBe(
      "Moved automatically to Following Up",
    );
    expect(interactionPhrase("en", move("B-1", "sending_proposal", "following_up"))).toBe(
      "Moved to Following Up",
    );
  });

  it("and a move HE chose the destination for is not claimed as the engine's", () => {
    /* the attended meeting outcome: `auto: true` on the row, but the destination
       came out of the form he filled in, so the automatic wording would be the
       exact inversion of the one above (review, Run 097) */
    expect(interactionPhrase("en", auto("T-6", "meeting_setting", "sending_proposal"))).toBe(
      "Moved to Sending Proposals",
    );
    expect(interactionPhrase("en", auto("B-7", "meeting_setting", "sending_proposal"))).toBe(
      "Moved to Sending Proposals",
    );
    /* an attended-meeting WIN reads exactly like a win reached any other way */
    expect(interactionPhrase("en", auto("B-9", "meeting_setting", "won"))).toBe("Moved to Won");
    expect(interactionPhrase("en", move("B-9", "negotiation", "won"))).toBe("Moved to Won");
    expect(interactionPhrase("ar", auto("T-6", "meeting_setting", "sending_proposal"))).toBe(
      interactionPhrase("ar", move("T-3", "meeting_setting", "sending_proposal")),
    );
    /* and the delayed outcome, which shares B-7, still never says "Moved" */
    expect(interactionPhrase("en", auto("B-7", "meeting_setting", "meeting_setting"))).not.toContain(
      "Moved",
    );
  });

  it("a record written IN PLACE never says 'Moved'", () => {
    for (const row of [
      group("FU-AGAIN"),
      group("NEG-DUE"),
      group("MTG-RESCHEDULE"),
      move("T-7", "meeting_setting", "meeting_setting"),
      move("B-7", "meeting_setting", "meeting_setting"),
    ]) {
      expect(interactionPhrase("en", row)).not.toContain("Moved");
      expect(interactionPhrase("ar", row)).not.toContain("انتقل");
    }
  });

  it("an UNKNOWN trigger still yields a countable phrase rather than a crash or a blank", () => {
    /* an unfamiliar trigger on a KNOWN action falls back to that action's own
       bilingual word — weak, but true and readable */
    for (const locale of LOCALES) {
      const phrase = interactionPhrase(locale, mk("update", "B-12"));
      expect(phrase).toBeTruthy();
      expect(phrase).toBe(history.actions.update![locale]);
    }
    /* nothing recognisable AT ALL still yields the generic verb, so the row is
       still rendered and still counted — the mutation check, as an assertion:
       this is what the completeness cases above would report for a new trigger */
    for (const locale of LOCALES) {
      const phrase = interactionPhrase(locale, mk("teleported", "Z-42"));
      expect(phrase).toBeTruthy();
      expect(isGenericPhrase(locale, phrase)).toBe(true);
    }
    expect(() => interactionPhrase("en", mk("", ""))).not.toThrow();
    expect(interactionPhrase("en", mk("", ""))).toBeTruthy();
  });

  it("every LOG_ACTIONS value resolves — a new action cannot take the screen down", () => {
    for (const action of LOG_ACTIONS) {
      for (const locale of LOCALES) {
        const phrase = interactionPhrase(locale, mk(action, "something-new"));
        expect(phrase, `${action} / ${locale}`).toBeTruthy();
      }
    }
  });

  it("every stage the pipelines can move a lead TO has an Arabic name to move to", () => {
    /* the phrase interpolates stageLabel, so a stage with no translation would
       print an English word inside an Arabic sentence */
    for (const stage of Object.keys(stageMsgs)) {
      expect(stageMsgs[stage]!.ar).toBeTruthy();
      /* the FROM stage is deliberately one no pipeline has, so the row can never
         accidentally be a same-stage record for the stage under test */
      expect(interactionPhrase("ar", move("B-1", "__elsewhere__", stage))).toContain(
        stageMsgs[stage]!.ar,
      );
    }
  });

  it("every page-chrome string has real Arabic, never an English fallback", () => {
    for (const [key, msg] of Object.entries(dailyReport)) {
      expect(msg.en, key).toBeTruthy();
      expect(msg.ar, key).toBeTruthy();
      /* a key whose Arabic is byte-identical to its English is an untranslated
         string — allowed only where the Arabic really is the same (there are
         none here; every value is a sentence or a verb) */
      expect(msg.ar, `${key} was never translated`).not.toBe(msg.en);
    }
  });
});

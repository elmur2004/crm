import { BSYSTEMS_STAGES } from "../constants";
import type { PipelineConfig } from "../types";

/* ============================================================================
   ADR-073 — MINDOO, the third company.

   Founder: "we need to add a third CRM called Mindoo with the exact same switch
   mechanic and the exact same info and details." Asked which of the two it
   copies, he chose B-SYSTEMS — so this is the B-Systems pipeline: the same
   eight columns including Negotiation, the same field groups, and a Win that
   opens the milestone tab and writes a Won Deal.

   IT SHARES `BSYSTEMS_STAGES` RATHER THAN DECLARING ITS OWN COPY. "The exact
   same details" is the requirement, and two identical arrays are two things to
   keep identical — the day somebody adds a stage to one, the boards silently
   disagree. One array, two companies; the stage ids are pipeline vocabulary,
   not company names, and nothing keys off which company owns them.

   THE ONE REAL DIFFERENCE IS THE ROLE, and it is not cosmetic. The B-Systems
   config is ROLE-AWARE: Won is reserved for `bsystems_admin` / `bsystems_sales`
   because agents and partners must never close a deal themselves (SPEC §3).
   Mindoo has ONE staff role and no external agents, so that reservation has
   nothing to protect — and left copied verbatim it would have been actively
   wrong: `mindoo_staff` is in neither list, so nobody in Mindoo could ever mark
   a lead Won. The role gate is therefore `mindoo_staff`, which is the whole of
   the company's staff.
   ========================================================================== */

const WON_ROLES = ["mindoo_staff"] as const;

/* Founder (same-stage records, inherited with the pipeline): another follow-up
   in Following Up, the response date agreed in Negotiation, a rescheduled
   meeting in Meeting Setting. */
function sameStageExtras(stage: string): string[] {
  if (stage === "following_up") return ["follow_up_again"];
  if (stage === "negotiation") return ["negotiation_follow_up"];
  if (stage === "meeting_setting") return ["reschedule_meeting"];
  return [];
}

export const mindooCrmConfig: PipelineConfig = {
  kind: "bsystems", // the pipeline SHAPE it runs; not the company it belongs to
  stages: BSYSTEMS_STAGES,
  terminalStages: ["won", "lost"],
  intakeStage: "new",
  followUpStage: "following_up",
  meetingStage: "meeting_setting",
  proposalStage: "sending_proposal",
  negotiationStage: "negotiation",
  postponeStage: "postponed", // ADR-072 — carried over with everything else
  didntAnswerStage: null,
  wonStage: "won",
  lostStage: "lost",
  nextActions(stage, role) {
    if (stage === "won" || stage === "lost") return [];
    const base = [
      "following_up",
      "meeting_setting",
      "sending_proposal",
      "negotiation",
      "postponed",
      "lost",
    ];
    const all = WON_ROLES.includes(role as (typeof WON_ROLES)[number]) ? [...base, "won"] : base;
    return [...all, ...sameStageExtras(stage)];
  },
  attendedDestinations(role) {
    const base = ["sending_proposal", "negotiation", "lost", "following_up"];
    return WON_ROLES.includes(role as (typeof WON_ROLES)[number]) ? [...base, "won"] : base;
  },
  cancelledDestinations() {
    /* T-8 / A-3 plus ADR-072 — a no-show is a cancelled meeting, and parking
       the lead is one of the three answers to it. */
    return ["following_up", "postponed", "lost"];
  },
  dragEnabled: true,
  wonRoles: WON_ROLES,
  wonRequiredGroup: { group: "won_deal" }, // the milestone tab, as B-Systems
  wonSideEffect: "create_won_deal",
};

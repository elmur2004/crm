import { BSYSTEMS_STAGES } from "../constants";
import type { PipelineConfig } from "../types";

/* V2 (ADR-030): THE unified B-Systems CRM pipeline — all owner buckets (internal /
   agent / partner / admin leads) run on it.
   - negotiation is a stage (group: a note).
   - Won is reserved for bsystems_admin ("confirm win") and bsystems_sales (their
     forms mirror ByteForce, which includes Won). Agents/partners never reach Won —
     they flag "ready to close" instead (service-level, not a transition).
   - Drag & drop is enabled for every role; a drop is validated exactly like the
     matching next action.
   - Won opens the V2 milestone tab (group "won_deal": estimated value, commission
     PERCENT, milestones with value/commission/expected dates). */

const WON_ROLES = ["bsystems_admin", "bsystems_sales"] as const;

/* Founder: same-stage records — another follow-up in Following Up, the
   response-due date agreed in Negotiation ("the date we will have a response
   for them on the proposal"), a rescheduled meeting in Meeting Setting. Every
   role that can act on the lead gets them: they are records, not wins. */
function sameStageExtras(stage: string): string[] {
  if (stage === "following_up") return ["follow_up_again"];
  if (stage === "negotiation") return ["negotiation_follow_up"];
  if (stage === "meeting_setting") return ["reschedule_meeting"];
  return [];
}

export const bsystemsCrmConfig: PipelineConfig = {
  kind: "bsystems",
  stages: BSYSTEMS_STAGES,
  terminalStages: ["won", "lost"],
  intakeStage: "new",
  followUpStage: "following_up",
  meetingStage: "meeting_setting",
  proposalStage: "sending_proposal",
  negotiationStage: "negotiation",
  didntAnswerStage: null,
  wonStage: "won",
  lostStage: "lost",
  nextActions(stage, role) {
    if (stage === "won" || stage === "lost") return [];
    const base = ["following_up", "meeting_setting", "sending_proposal", "negotiation", "lost"];
    const all = WON_ROLES.includes(role as (typeof WON_ROLES)[number]) ? [...base, "won"] : base;
    return [...all, ...sameStageExtras(stage)];
  },
  attendedDestinations(role) {
    const base = ["sending_proposal", "negotiation", "lost", "following_up"];
    return WON_ROLES.includes(role as (typeof WON_ROLES)[number]) ? [...base, "won"] : base;
  },
  dragEnabled: true, // V2 §3 — all roles drag; drop opens the stage form
  wonRoles: WON_ROLES,
  wonRequiredGroup: { group: "won_deal" }, // V2 §4 milestone tab
  wonSideEffect: "create_won_deal",
};

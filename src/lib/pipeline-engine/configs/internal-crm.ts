import { INTERNAL_STAGES } from "../constants";
import type { PipelineConfig } from "../types";

/* Founder: same-stage records — another follow-up while still Following Up, a
   rescheduled meeting while still Meeting Setting. Offered from the stage that
   owns the record; the engine resolves them to that same stage. */
function sameStageExtras(stage: string): string[] {
  if (stage === "following_up") return ["follow_up_again"];
  if (stage === "meeting_setting") return ["reschedule_meeting"];
  return [];
}

/* Apps A & B CRM (SPEC §6, §10.1). Action-driven only in v1 (A-7).
   ADR-011: a direct "Won" action is exposed from every active stage (T-9's From
   column is "Any active"; §6.1's printed enum omits it). Re-selecting the current
   stage is allowed — groups accumulate as history (A-2). */

const ACTIVE_ACTIONS = ["following_up", "meeting_setting", "sending_proposal", "won", "lost"] as const;

export const internalCrmConfig: PipelineConfig = {
  kind: "internal",
  stages: INTERNAL_STAGES,
  terminalStages: ["won", "lost"],
  intakeStage: "new",
  followUpStage: "following_up",
  meetingStage: "meeting_setting",
  proposalStage: "sending_proposal",
  didntAnswerStage: null,
  wonStage: "won",
  lostStage: "lost",
  nextActions(stage) {
    if (stage === "won" || stage === "lost") return [];
    return [...ACTIVE_ACTIONS, ...sameStageExtras(stage)];
  },
  attendedDestinations() {
    // T-6: destination choice is mandatory
    return ["sending_proposal", "won", "lost", "following_up"];
  },
  cancelledDestinations() {
    /* T-8 / A-3, unchanged: the pair the core used to hardcode as
       [followUpStage, lostStage]. It is a config SLOT since ADR-059 because the
       prospect pipeline has no follow-up stage to compose it from. */
    return ["following_up", "lost"];
  },
  dragEnabled: true, // founder (ADR-042): overrides A-7 — the board drags like the B-Systems one
  wonRoles: null, // any staff member of the owning brand (brand scoping in guards)
  wonRequiredGroup: { group: "won" },
  wonSideEffect: "create_client", // T-9 / A-1
};

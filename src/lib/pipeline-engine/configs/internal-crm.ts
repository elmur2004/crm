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

/* ADR-072 — `postponed` joins the actions offered from every active stage, and
   because it is not terminal it is also a stage the same list is offered FROM:
   a parked lead moves back to Following Up or on to Lost with no special case
   in the core. That is the founder's "reversible, an ordinary active stage" in
   one array entry. */
const ACTIVE_ACTIONS = [
  "following_up",
  "meeting_setting",
  "sending_proposal",
  "postponed",
  "won",
  "lost",
] as const;

export const internalCrmConfig: PipelineConfig = {
  kind: "internal",
  stages: INTERNAL_STAGES,
  terminalStages: ["won", "lost"],
  intakeStage: "new",
  followUpStage: "following_up",
  meetingStage: "meeting_setting",
  proposalStage: "sending_proposal",
  postponeStage: "postponed", // ADR-072
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
    /* T-8 / A-3, plus ADR-072. The founder named "no show in the meeting" as one
       of the three reasons to park a lead, so the cancelled outcome — which is
       where a no-show is recorded — must be able to land there directly. The
       original pair is untouched and still first. */
    return ["following_up", "postponed", "lost"];
  },
  dragEnabled: true, // founder (ADR-042): overrides A-7 — the board drags like the B-Systems one
  wonRoles: null, // any staff member of the owning brand (brand scoping in guards)
  wonRequiredGroup: { group: "won" },
  wonSideEffect: "create_client", // T-9 / A-1
};

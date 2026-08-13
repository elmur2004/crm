import { INTERNAL_STAGES } from "../constants";
import type { PipelineConfig } from "../types";

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
    return ACTIVE_ACTIONS;
  },
  attendedDestinations() {
    // T-6: destination choice is mandatory
    return ["sending_proposal", "won", "lost", "following_up"];
  },
  dragEnabled: true, // founder (ADR-042): overrides A-7 — the board drags like the B-Systems one
  wonRoles: null, // any staff member of the owning brand (brand scoping in guards)
  wonRequiredGroup: { group: "won" },
  wonSideEffect: "create_client", // T-9 / A-1
};

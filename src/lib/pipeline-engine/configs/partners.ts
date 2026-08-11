import { PARTNER_STAGES } from "../constants";
import type { PipelineConfig } from "../types";

/* App B Partners acquisition pipeline (SPEC §7.2, §10.2).
   PP-1's From column is "Lead / active", so didnt_answer is offered from every
   active stage. ADR-010: meeting-attended destinations exclude a proposals stage
   (none exists here); Won routes through the PP-4 completeness gate. */

const ACTIVE_ACTIONS = ["didnt_answer", "following_up", "meeting_setting", "won", "lost"] as const;

export const partnersConfig: PipelineConfig = {
  kind: "partners",
  stages: PARTNER_STAGES,
  terminalStages: ["won", "lost"],
  intakeStage: "lead",
  followUpStage: "following_up",
  meetingStage: "meeting_setting",
  proposalStage: null,
  didntAnswerStage: "didnt_answer",
  wonStage: "won",
  lostStage: "lost",
  nextActions(stage) {
    if (stage === "won" || stage === "lost") return [];
    return ACTIVE_ACTIONS;
  },
  attendedDestinations() {
    return ["following_up", "won", "lost"]; // ADR-010
  },
  dragEnabled: true, // founder V4: the Partnership CRM board is draggable too
  wonRoles: null,
  wonRequiredGroup: { group: "won_partner" }, // §7.2 gate — completeness enforced by Zod
  wonSideEffect: "create_partner", // PP-4 (A-5)
};

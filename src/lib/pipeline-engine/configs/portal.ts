import { PORTAL_STAGES } from "../constants";
import type { PipelineConfig } from "../types";

/* App C Portal CRM (SPEC §8.2, §10.3). Trello-style drag & drop (§5.4) — except
   Won, which is admin-only in every form: drag, next action, and attended
   destination (P-2, P-5, P-6). Next actions are "the other stages, excluding Won
   for reps" (§8.2). */

export const portalConfig: PipelineConfig = {
  kind: "portal",
  stages: PORTAL_STAGES,
  terminalStages: ["won", "lost"],
  intakeStage: "leads",
  followUpStage: "following_up",
  meetingStage: "meeting_setting",
  proposalStage: "proposal_sending",
  didntAnswerStage: null,
  wonStage: "won",
  lostStage: "lost",
  nextActions(stage, role) {
    if (stage === "won" || stage === "lost") return [];
    const others = PORTAL_STAGES.filter((s) => s !== stage && s !== "lost" && s !== "won");
    const actions = [...others, "lost"]; // lost always available; won admin-only
    return role === "portal_admin" ? [...actions, "won"] : actions;
  },
  attendedDestinations(role) {
    const base = ["proposal_sending", "lost", "following_up"];
    return role === "portal_admin" ? [...base, "won"] : base; // P-5: Won excluded for reps
  },
  dragEnabled: true, // P-1
  wonRoles: ["portal_admin"], // P-2 / P-6
  wonRequiredGroup: null, // P-6: WonDeal auto-created; admin fills values later (§8.5.3)
  wonSideEffect: "create_won_deal",
};

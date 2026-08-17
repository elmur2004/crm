import { PARTNER_STAGES } from "../constants";
import type { PipelineConfig } from "../types";

/* App B Partners & Agents acquisition pipeline (SPEC §7.2, §10.2).
   PP-1's From column is "Lead / active", so didnt_answer is offered from every
   active stage. ADR-010: meeting-attended destinations exclude a proposals stage
   (none exists here); Won routes through the PP-4 completeness gate.

   Founder: the board now carries partner AND agent cards. The stages, the next
   actions, the drag rules and every stage form are IDENTICAL — the single
   divergence is the Won gate, so the config is PARAMETERIZED by the card's kind
   rather than forked into a second pipeline (SPEC §5's one-engine rule). */

const ACTIVE_ACTIONS = ["didnt_answer", "following_up", "meeting_setting", "won", "lost"] as const;

/* Founder: same-stage records — the partnership pipeline has Following Up and
   Meeting Setting too, so it gets the same "another follow-up" / "reschedule"
   buttons rather than a special-cased UI on the leads side only. */
function sameStageExtras(stage: string): string[] {
  if (stage === "following_up") return ["follow_up_again"];
  if (stage === "meeting_setting") return ["reschedule_meeting"];
  return [];
}

/** The card kinds the board carries (founder: "it could be a partner or an agent"). */
export const PROSPECT_KINDS = ["partner", "agent"] as const;
export type ProspectKind = (typeof PROSPECT_KINDS)[number];

export function isProspectKind(value: string): value is ProspectKind {
  return (PROSPECT_KINDS as readonly string[]).includes(value);
}

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
    return [...ACTIVE_ACTIONS, ...sameStageExtras(stage)];
  },
  attendedDestinations() {
    return ["following_up", "won", "lost"]; // ADR-010
  },
  dragEnabled: true, // founder V4: the Partnership CRM board is draggable too
  wonRoles: null,
  wonRequiredGroup: { group: "won_partner" }, // §7.2 gate — completeness enforced by Zod
  wonSideEffect: "create_partner", // PP-4 (A-5)
};

/** The partners pipeline as it applies to ONE card: everything shared, the Won
    gate swapped for the card's kind. `partner` returns the config verbatim. */
export function partnersConfigFor(kind: string): PipelineConfig {
  if (kind !== "agent") return partnersConfig;
  return {
    ...partnersConfig,
    /* PP-4a: the agent gate collects the signup profile + the credentials the
       admin sets, and mints the account instead of a directory Partner. */
    wonRequiredGroup: { group: "won_agent" },
    wonSideEffect: "create_agent",
  };
}

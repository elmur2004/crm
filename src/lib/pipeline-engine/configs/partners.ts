import { AGENT_STAGES, PARTNER_STAGES } from "../constants";
import type { PipelineConfig, RequiredGroup, SideEffectKind } from "../types";

/* App B Partners & Agents acquisition pipeline (SPEC §7.2/§10.2 for partner
   cards, §7.2a/§10.2a for agent cards).
   PP-1's From column is "Lead / active", so didnt_answer is offered from every
   active stage. ADR-010: meeting-attended destinations exclude a proposals stage
   (none exists here); Won routes through the PP-4 completeness gate.

   Founder: the board carries partner AND agent cards, and (ADR-057) the two
   kinds now run DIFFERENT stage vocabularies:

     partner  lead · didnt_answer · following_up · meeting_setting · won · lost
     agent    lead · contacted    · didnt_answer · meeting_setting · qualified · lost

   That is NOT a second pipeline. Everything below is derived from the config's
   ROLE SLOTS — `contacted` simply plays the followUpStage role and `qualified`
   plays the wonStage role (and so carries the account gate) — so the two kinds
   are one parameterized config family, per CLAUDE.md's one-engine rule. */

/** The next actions offered from any active stage: one per role slot, in the
    order the board has always shown them. */
function activeActions(c: PipelineConfig): string[] {
  return [c.didntAnswerStage!, c.followUpStage, c.meetingStage, c.wonStage, c.lostStage];
}

/* Founder: same-stage records — the partnership pipeline has a follow-up stage
   and a Meeting Setting too, so it gets the same "another follow-up" /
   "reschedule" buttons rather than a special-cased UI on the leads side only. */
function sameStageExtras(c: PipelineConfig, stage: string): string[] {
  if (stage === c.followUpStage) return ["follow_up_again"];
  if (stage === c.meetingStage) return ["reschedule_meeting"];
  return [];
}

/** The card kinds the board carries (founder: "it could be a partner or an agent"). */
export const PROSPECT_KINDS = ["partner", "agent"] as const;
export type ProspectKind = (typeof PROSPECT_KINDS)[number];

export function isProspectKind(value: string): value is ProspectKind {
  return (PROSPECT_KINDS as readonly string[]).includes(value);
}

/** The only slots that differ between the two kinds. Everything else — intake,
    meeting, didn't-answer, lost, drag rules, next actions, destinations — is
    shared code reading these slots. */
type KindSlots = {
  stages: readonly string[];
  terminalStages: readonly string[];
  followUpStage: string;
  wonStage: string;
  wonRequiredGroup: RequiredGroup;
  wonSideEffect: SideEffectKind;
  triggers: NonNullable<PipelineConfig["triggers"]>;
};

function buildPartnersConfig(slots: KindSlots): PipelineConfig {
  const config: PipelineConfig = {
    kind: "partners",
    stages: slots.stages,
    terminalStages: slots.terminalStages,
    intakeStage: "lead",
    followUpStage: slots.followUpStage,
    meetingStage: "meeting_setting",
    proposalStage: null,
    didntAnswerStage: "didnt_answer",
    wonStage: slots.wonStage,
    lostStage: "lost",
    nextActions(stage) {
      if (config.terminalStages.includes(stage)) return [];
      return [...activeActions(config), ...sameStageExtras(config, stage)];
    },
    attendedDestinations() {
      return [config.followUpStage, config.wonStage, config.lostStage]; // ADR-010
    },
    dragEnabled: true, // founder V4: the Partnership CRM board is draggable too
    wonRoles: null,
    wonRequiredGroup: slots.wonRequiredGroup,
    wonSideEffect: slots.wonSideEffect,
    triggers: slots.triggers,
  };
  return config;
}

export const partnersConfig: PipelineConfig = buildPartnersConfig({
  stages: PARTNER_STAGES,
  terminalStages: ["won", "lost"],
  followUpStage: "following_up",
  wonStage: "won",
  wonRequiredGroup: { group: "won_partner" }, // §7.2 gate — completeness enforced by Zod
  wonSideEffect: "create_partner", // PP-4 (A-5)
  triggers: { didntAnswer: "PP-1", numberAdded: "PP-2", generic: "PP-3", won: "PP-4" },
});

/* ADR-057: the agent variant. `contacted` IS the follow-up stage and
   `qualified` IS the Won stage, so the whole shared body — the next actions,
   the attended destinations, the same-stage buttons, the follow-up context
   rule, the account gate — lands on the founder's vocabulary with no forked
   code. §10.2a rows get their own ids so every normative row is testable. */
export const agentsConfig: PipelineConfig = buildPartnersConfig({
  stages: AGENT_STAGES,
  terminalStages: ["qualified", "lost"],
  followUpStage: "contacted",
  wonStage: "qualified",
  /* PA-4: the agent gate collects the signup profile + the credentials the
     admin sets, and mints the account instead of a directory Partner. */
  wonRequiredGroup: { group: "won_agent" },
  wonSideEffect: "create_agent",
  triggers: { didntAnswer: "PA-1", numberAdded: "PA-2", generic: "PA-3", won: "PA-4" },
});

/** The partners pipeline as it applies to ONE card: the shared engine with the
    stage vocabulary and Won gate this card's kind runs. `partner` returns the
    config verbatim. */
export function partnersConfigFor(kind: string): PipelineConfig {
  return kind === "agent" ? agentsConfig : partnersConfig;
}

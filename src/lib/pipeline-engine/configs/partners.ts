import { PROSPECT_STAGES } from "../constants";
import type { PipelineConfig, RequiredGroup, SideEffectKind } from "../types";

/* App B Partners & Agents acquisition pipeline (SPEC §7.2 / §10.2).

   ADR-059 — ONE stage set for BOTH kinds of card, in the founder's own column
   order:

     lead · contacted · didnt_answer · meeting_setting · waiting · qualified · lost

   Founder, asked whether partners and agents should keep separate vocabularies:
   "Same stages for both." That reverses ADR-057's split (partner cards used to
   run following_up/won) while keeping the two card KINDS distinct — a qualified
   PARTNER still becomes a partner in the directory, the column is simply called
   Qualified now.

   The two kinds therefore differ in exactly ONE thing: the terminal side
   effect. Everything else — the stages, the terminal pair, the next actions,
   the destinations, the same-stage buttons — is shared code, so there is one
   config family and no fork (CLAUDE.md's one-engine rule).

   Two founder rules are encoded as ABSENCES here, and both are load-bearing:
     · `followUpStage: null` — NO stage plays the follow-up role (item 2.1:
       "Contacted should only indicate that contact has been made"). A follow-up
       is written only by the deliberate `follow_up_again` action, which is why
       that action is offered from every active stage below.
     · the agent kind's `wonRequiredGroup` / `wonSideEffect` are null (item 1.3:
       "Moving a lead to Qualified should not require creating or entering an
       email or password"). Minting the login is a separate, explicit admin
       action afterwards (PP-4a, services/partners.createAgentAccount). */

/** The next actions offered from any active stage: every OTHER column, in board
    order. ADR-059 — the action set is the column set, which is what makes
    "Waiting moves out in both directions" (founder 1.1) true by construction
    rather than by a hand-maintained list. */
function activeActions(c: PipelineConfig, stage: string): string[] {
  return c.stages.filter((s) => s !== stage);
}

/* Founder: same-stage records. `follow_up_again` is offered from EVERY active
   stage now (ADR-059): with no follow-up STAGE, this action is the only way a
   FollowUp is ever created, so it must be reachable wherever a follow-up makes
   sense — and never automatic. `reschedule_meeting` still belongs to the
   meeting stage, which owns the record it replaces. */
function sameStageExtras(c: PipelineConfig, stage: string): string[] {
  const extras = ["follow_up_again"];
  if (stage === c.meetingStage) extras.push("reschedule_meeting");
  return extras;
}

/** The card kinds the board carries (founder: "it could be a partner or an agent"). */
export const PROSPECT_KINDS = ["partner", "agent"] as const;
export type ProspectKind = (typeof PROSPECT_KINDS)[number];

export function isProspectKind(value: string): value is ProspectKind {
  return (PROSPECT_KINDS as readonly string[]).includes(value);
}

/** The ONLY slots that differ between the two kinds: what Qualified does.
    Everything else in the config below is shared, literal or slot-derived. */
type KindSlots = {
  wonRequiredGroup: RequiredGroup | null;
  wonSideEffect: SideEffectKind | null;
  /** §10.2's terminal row for this kind — PP-4 (partner) / PP-6 (agent) */
  wonTrigger: string;
};

/** Qualified and Lost — the SAME pair for both kinds (ADR-059). Waiting is
    deliberately NOT here: founder 1.1 requires a Waiting card to stay fully
    editable and to move out again in both directions. */
const TERMINAL_STAGES = ["qualified", "lost"] as const;

function buildProspectConfig(slots: KindSlots): PipelineConfig {
  const config: PipelineConfig = {
    kind: "partners",
    stages: PROSPECT_STAGES,
    terminalStages: TERMINAL_STAGES,
    intakeStage: "lead",
    /* ADR-059 / founder 2.1 — no stage implies a follow-up. See the header. */
    followUpStage: null,
    meetingStage: "meeting_setting",
    proposalStage: null,
    didntAnswerStage: "didnt_answer",
    wonStage: "qualified",
    lostStage: "lost",
    nextActions(stage) {
      if (config.terminalStages.includes(stage)) return [];
      return [...activeActions(config, stage), ...sameStageExtras(config, stage)];
    },
    attendedDestinations() {
      /* ADR-010: no proposals stage here. Waiting joins the list because it is
         an ordinary active stage — "we met them, now we wait" is exactly the
         holding state the founder asked for. */
      return ["contacted", "waiting", "qualified", "lost"];
    },
    cancelledDestinations() {
      // A-3, minus Qualified: a cancelled meeting never qualifies anyone.
      return ["contacted", "waiting", "lost"];
    },
    dragEnabled: true, // founder V4: the Partners & Agents board is draggable
    wonRoles: null,
    wonRequiredGroup: slots.wonRequiredGroup,
    wonSideEffect: slots.wonSideEffect,
    triggers: {
      didntAnswer: "PP-1",
      numberAdded: "PP-2",
      generic: "PP-3",
      won: slots.wonTrigger,
    },
  };
  return config;
}

/* PP-4 — a partner qualifies: the §7.2 completeness gate (company, key person,
   role, address, number, business activity, importance — never an email, never
   a password) and the directory Partner it creates. */
export const partnersConfig: PipelineConfig = buildProspectConfig({
  wonRequiredGroup: { group: "won_partner" },
  wonSideEffect: "create_partner",
  wonTrigger: "PP-4",
});

/* PP-6 — an agent qualifies: founder 1.3, a PURE stage move. No field group, no
   credentials, no account, no side effect. A qualified agent with no login is a
   legitimate state; the admin mints the account afterwards with the explicit
   "Create the agent's account" action (PP-4a). */
export const agentsConfig: PipelineConfig = buildProspectConfig({
  wonRequiredGroup: null,
  wonSideEffect: null,
  wonTrigger: "PP-6",
});

/** The prospect pipeline as it applies to ONE card: the shared engine, with the
    Qualified behaviour this card's kind carries. Anything that is not an
    `agent` is a partner card — the same complement the data migration uses. */
export function partnersConfigFor(kind: string): PipelineConfig {
  return kind === "agent" ? agentsConfig : partnersConfig;
}

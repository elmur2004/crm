import type { FollowUpContext, Role } from "./constants";

/* Engine contract (pipeline-engine skill): pure transition core. The engine never
   touches the database — it validates a proposed move and returns what must happen
   (target stage, which field group must be persisted with the move, side-effect
   descriptors). Services execute everything atomically in one transaction and write
   the ActivityLog entry the result prescribes (T-10). */

export type PipelineKind = "internal" | "partners" | "bsystems";

/** Which stage-owned field group must be saved together with this transition. */
export type RequiredGroup =
  | { group: "follow_up"; context: FollowUpContext }
  | { group: "meeting" }
  | { group: "meeting_reschedule" } // T-7: new date & time on the existing meeting
  | { group: "proposal" }
  | { group: "lost" }
  | { group: "won" } // internal Won fields (§6.2)
  | { group: "won_partner" } // §7.2 completeness gate fields
  | { group: "won_agent" } // founder: the AGENT card's gate — profile + credentials
  | { group: "won_deal" } // V2 §4: milestone tab (percent + dated milestones)
  | { group: "negotiation" } // V2: note
  | { group: "numbers" }; // PP-1: reveal Number 2 / Number 3

export type SideEffectKind =
  | "create_client" // T-9 (A-1)
  | "create_partner" // PP-4
  | "create_agent" // PP-4a — founder: the admin mints the agent's account
  | "create_won_deal"; // P-6

export type EngineEvent =
  | { type: "next_action"; action: string } // §5.1 — T-1…T-4/T-9, PP-1/PP-3/PP-4, P-3
  | { type: "drag"; to: string } // §5.4 — P-1/P-2 (portal only)
  | { type: "proposal_sent" } // §5.3 — T-5 / P-4
  | {
      type: "meeting_outcome"; // T-6 / T-7 / T-8, P-5
      outcome: "attended" | "cancelled" | "delayed";
      destination?: string;
    }
  | { type: "number_added"; slot: 2 | 3 }; // PP-2
export interface EngineContext {
  role: Role;
}

export type TransitionOk = {
  ok: true;
  fromStage: string;
  toStage: string;
  /** null → no group opens (e.g. drag back to intake, admin won) */
  requiredGroup: RequiredGroup | null;
  sideEffects: SideEffectKind[];
  /** SPEC §10 row id — becomes ActivityLog.trigger (T-10) */
  logTrigger: string;
  /** true when the engine moved the card without a user-chosen action (§5.3) */
  auto: boolean;
};

export type TransitionReject = {
  ok: false;
  code:
    | "terminal_stage"
    | "unknown_action"
    | "won_forbidden"
    | "destination_required"
    | "destination_invalid"
    | "event_invalid_for_stage"
    | "drag_not_supported";
  message: string;
};

export type TransitionResult = TransitionOk | TransitionReject;

export interface PipelineConfig {
  kind: PipelineKind;
  stages: readonly string[];
  terminalStages: readonly string[];
  intakeStage: string; // new | lead | leads
  followUpStage: string;
  meetingStage: string;
  proposalStage: string | null; // partners has none (§7.2, ADR-010)
  negotiationStage?: string | null; // bsystems only (V2)
  didntAnswerStage: string | null; // partners only
  wonStage: string;
  lostStage: string;
  /** next-action ids offered from a stage for a role (drives UI + validation) */
  nextActions(stage: string, role: Role): readonly string[];
  /** T-6/P-5 destinations after outcome=attended, per role (ADR-010 for partners) */
  attendedDestinations(role: Role): readonly string[];
  dragEnabled: boolean; // portal only in v1 (A-7)
  /** roles allowed to move a card into Won (portal: admin only — P-2/P-6) */
  wonRoles: readonly Role[] | null; // null = any role with pipeline access
  wonRequiredGroup: RequiredGroup | null;
  wonSideEffect: SideEffectKind | null;
}

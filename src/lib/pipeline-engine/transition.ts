import { isSameStageAction, type FollowUpContext, type SameStageAction } from "./constants";
import type {
  EngineContext,
  EngineEvent,
  PipelineConfig,
  RequiredGroup,
  TransitionOk,
  TransitionReject,
  TransitionResult,
} from "./types";

/* The pure transition core (SPEC §5, §10 — every row of the transition tables).
   No I/O, no dates, no randomness: (config, state, event, ctx) → result.
   Services persist the move + required group + side effects atomically and write
   the ActivityLog entry from `logTrigger` (T-10). */

function reject(code: TransitionReject["code"], message: string): TransitionReject {
  return { ok: false, code, message };
}

function ok(
  partial: Omit<TransitionOk, "ok" | "sideEffects" | "auto"> &
    Partial<Pick<TransitionOk, "sideEffects" | "auto">>,
): TransitionOk {
  return { ok: true, sideEffects: [], auto: false, ...partial };
}

/** T-1's "context per origin": which follow-up context a move into Following Up gets. */
export function followUpContextFor(config: PipelineConfig, fromStage: string): FollowUpContext {
  if (config.proposalStage && fromStage === config.proposalStage) return "after_proposal";
  if (fromStage === config.meetingStage) return "after_meeting";
  return "initial";
}

/* ---- founder: same-stage records (SAME_STAGE_ACTIONS) ----
   A same-stage action adds the stage's OWN record without moving the card:
   another follow-up while still Following Up, the response date promised in
   Negotiation, a fresh meeting that supersedes the one being rescheduled.
   Their triggers sit deliberately OUTSIDE the SPEC §10 tables — they are new
   founder rows, named for what they are (the same convention the existing
   non-§10 rows use: B-RTC, no_answer, archived). */
export const SAME_STAGE_GROUPS: Record<SameStageAction, RequiredGroup> = {
  follow_up_again: { group: "follow_up", context: "initial" },
  negotiation_follow_up: { group: "follow_up", context: "after_negotiation" },
  /* NOT the "meeting_reschedule" GROUP (T-7 edits the existing meeting in
     place): this records a NEW meeting, so the boards and the To-Do — which
     both read the LATEST record — swap to it and the old one stops counting. */
  reschedule_meeting: { group: "meeting" },
};

const SAME_STAGE_TRIGGERS: Record<SameStageAction, string> = {
  follow_up_again: "FU-AGAIN",
  negotiation_follow_up: "NEG-DUE",
  reschedule_meeting: "MTG-RESCHEDULE",
};

/** The field group a given target stage opens (SPEC §6.2 / §7.2 / §8.2).
    EXPORTED (ADR-059): the board and the action panel must ask the engine
    whether a move opens a form instead of restating the rule themselves —
    "Lead → Contacted requires nothing" (founder 1.2) has to be ONE answer. */
export function requiredGroupForTarget(
  config: PipelineConfig,
  fromStage: string,
  toStage: string,
): RequiredGroup | null {
  /* ADR-059: a null slot means NO stage opens a follow-up — the prospect
     pipeline's Contacted is a record that contact happened, nothing more. */
  if (config.followUpStage && toStage === config.followUpStage) {
    return { group: "follow_up", context: followUpContextFor(config, fromStage) };
  }
  if (toStage === config.meetingStage) return { group: "meeting" };
  if (config.proposalStage && toStage === config.proposalStage) return { group: "proposal" };
  if (toStage === config.lostStage) return { group: "lost" };
  /* ADR-072 — parking a lead ASKS WHY, every time. The founder described the
     popup before he described the column, and a move that recorded no reason
     would make the column a place leads vanish into rather than a list you can
     work back through. */
  if (config.postponeStage && toStage === config.postponeStage) return { group: "postpone" };
  if (config.negotiationStage && toStage === config.negotiationStage) {
    return { group: "negotiation" }; // V2 — a note entry
  }
  if (toStage === config.wonStage) return config.wonRequiredGroup;
  if (config.didntAnswerStage && toStage === config.didntAnswerStage) {
    return { group: "numbers" }; // PP-1: reveal Number 2 / Number 3
  }
  return null; // intake stage, or a stage that opens nothing (contacted / waiting)
}

/** The field group an ACTION opens from a stage — the same-stage actions
    included. The one entry point the UI should use: `null` means the move
    commits immediately with no form at all. */
export function requiredGroupFor(
  config: PipelineConfig,
  fromStage: string,
  action: string,
): RequiredGroup | null {
  return isSameStageAction(action)
    ? SAME_STAGE_GROUPS[action]
    : requiredGroupForTarget(config, fromStage, action);
}

/** Trigger ids per SPEC §10 rows / REQUIREMENTS-V2 (B-rows), per pipeline. */
function triggerForAction(config: PipelineConfig, toStage: string): string {
  if (config.kind === "internal") {
    if (toStage === config.followUpStage) return "T-1";
    if (toStage === config.meetingStage) return "T-2";
    if (toStage === config.proposalStage) return "T-3";
    if (toStage === config.lostStage) return "T-4";
    if (toStage === config.wonStage) return "T-9";
    /* ADR-042 addendum: a drag back to intake sits outside the §10.1 rows —
       T-0 is the internal generic move, mirroring B-1/PP-3's fallback role. */
    return "T-0";
  }
  if (config.kind === "partners") {
    /* ADR-059 — one stage set, one row family: PP-1 / PP-2 / PP-3 are shared by
       both kinds and only the TERMINAL row differs (PP-4 the partner's
       directory conversion, PP-6 the agent's credential-free qualification).
       The ids live on the config, so the core never names a pipeline's rows. */
    if (toStage === config.didntAnswerStage) return config.triggers?.didntAnswer ?? "PP-1";
    if (toStage === config.wonStage) return config.triggers?.won ?? "PP-4";
    return config.triggers?.generic ?? "PP-3";
  }
  if (config.kind === "bsystems") {
    if (toStage === config.wonStage) return "B-9"; // confirm win (V2 §4)
    if (config.negotiationStage && toStage === config.negotiationStage) return "B-4";
    return "B-1"; // stage move via action or drag
  }
  return "?";
}

function canSetWon(config: PipelineConfig, ctx: EngineContext): boolean {
  return config.wonRoles === null || config.wonRoles.includes(ctx.role);
}

export function transition(
  config: PipelineConfig,
  state: { stage: string },
  event: EngineEvent,
  ctx: EngineContext,
): TransitionResult {
  const from = state.stage;

  if (!config.stages.includes(from)) {
    return reject("event_invalid_for_stage", `Unknown stage "${from}" for ${config.kind} pipeline`);
  }

  /* Terminal stages accept nothing (won/lost are terminal — §5.1). */
  if (config.terminalStages.includes(from)) {
    return reject("terminal_stage", `Stage "${from}" is terminal — no further transitions`);
  }

  switch (event.type) {
    /* ------------- user-chosen Next Action (T-1…T-4, T-9, PP-1/3/4, P-3) ------------- */
    case "next_action": {
      const allowed = config.nextActions(from, ctx.role);
      if (!allowed.includes(event.action)) {
        if (event.action === config.wonStage && !canSetWon(config, ctx)) {
          return reject("won_forbidden", "Only the portal admin can move a deal to Won"); // P-2
        }
        return reject("unknown_action", `Action "${event.action}" is not available from "${from}"`);
      }
      if (event.action === config.wonStage && !canSetWon(config, ctx)) {
        return reject("won_forbidden", "Only the portal admin can move a deal to Won"); // P-2
      }
      /* founder: a same-stage record — the card stays exactly where it is and
         only the stage's own group is written (see SAME_STAGE_GROUPS). */
      if (isSameStageAction(event.action)) {
        return ok({
          fromStage: from,
          toStage: from,
          requiredGroup: SAME_STAGE_GROUPS[event.action],
          logTrigger: SAME_STAGE_TRIGGERS[event.action],
        });
      }
      const toStage = event.action;
      return ok({
        fromStage: from,
        toStage,
        requiredGroup: requiredGroupForTarget(config, from, toStage),
        sideEffects:
          toStage === config.wonStage && config.wonSideEffect ? [config.wonSideEffect] : [],
        logTrigger: triggerForAction(config, toStage),
      });
    }

    /* ------------- drag & drop (P-1 / P-2 — portal only, §5.4) ------------- */
    case "drag": {
      if (!config.dragEnabled) {
        return reject("drag_not_supported", "Drag & drop is not available on this pipeline (A-7)");
      }
      if (!config.stages.includes(event.to)) {
        return reject("unknown_action", `Unknown column "${event.to}"`);
      }
      if (event.to === config.wonStage && !canSetWon(config, ctx)) {
        return reject("won_forbidden", "Only the portal admin can move a deal to Won"); // P-2
      }
      if (event.to === from) {
        return reject("event_invalid_for_stage", "Card is already in this column");
      }
      const requiredGroup = requiredGroupForTarget(config, from, event.to);
      return ok({
        fromStage: from,
        toStage: event.to,
        requiredGroup,
        sideEffects:
          event.to === config.wonStage && config.wonSideEffect ? [config.wonSideEffect] : [],
        // V2: a drag is the same move as the matching action — same trigger id
        logTrigger: triggerForAction(config, event.to),
      });
    }

    /* ------------- Proposal "Sent" checked (T-5 / B-6 — §5.3) ------------- */
    case "proposal_sent": {
      /* followUpStage is checked too: a pipeline with no follow-up stage has
         nowhere to auto-return TO (it also has no proposal stage, so this is
         belt and braces that keeps the null out of `toStage`). */
      if (!config.proposalStage || from !== config.proposalStage || !config.followUpStage) {
        return reject(
          "event_invalid_for_stage",
          `proposal_sent only fires from "${config.proposalStage ?? "—"}"`,
        );
      }
      /* V2 §3: agents/partners auto-return to Following Up with NO follow-up form;
         admins/sales keep the after-proposal group. */
      const lightRole =
        config.kind === "bsystems" &&
        (ctx.role === "bsystems_agent" || ctx.role === "bsystems_partner");
      return ok({
        fromStage: from,
        toStage: config.followUpStage,
        requiredGroup: lightRole ? null : { group: "follow_up", context: "after_proposal" },
        logTrigger: config.kind === "bsystems" ? "B-6" : "T-5",
        auto: true,
      });
    }

    /* ------------- Meeting outcome (T-6 / T-7 / T-8, P-5) ------------- */
    case "meeting_outcome": {
      if (from !== config.meetingStage) {
        return reject("event_invalid_for_stage", "Meeting outcome applies in Meeting Setting only");
      }
      /* ADR-021: ActivityLog.trigger always cites the OWNING pipeline's §10 row —
         partners meeting outcomes are PP-3 ("same logic as T-6–T-8"); portal
         delayed/cancelled fall under P-3's "same rules as T-1…T-8". */
      const outcomeTrigger = (internalRow: string): string =>
        config.kind === "internal"
          ? internalRow
          : config.kind === "partners"
            ? (config.triggers?.generic ?? "PP-3")
            : "B-7";

      if (event.outcome === "delayed") {
        // T-7 (A-3): require a new date & time; card stays
        return ok({
          fromStage: from,
          toStage: from,
          requiredGroup: { group: "meeting_reschedule" },
          logTrigger: outcomeTrigger("T-7"),
        });
      }
      if (event.outcome === "cancelled") {
        /* T-8 (A-3): the user picks where the card lands. The destinations come
           from the CONFIG (ADR-059) — the lead pipelines still answer
           [followUpStage, lostStage]; the prospect pipeline answers
           Contacted / Waiting / Lost, because it has no follow-up stage at all
           and "Lost or nothing" would be a cliff the founder never asked for. */
        const allowed = config.cancelledDestinations(ctx.role);
        if (!event.destination) {
          return reject("destination_required", "Cancelled meeting: choose a destination");
        }
        if (!allowed.includes(event.destination)) {
          return reject(
            "destination_invalid",
            `"${event.destination}" is not a valid destination for a cancelled meeting`,
          );
        }
        return ok({
          fromStage: from,
          toStage: event.destination,
          requiredGroup: requiredGroupForTarget(config, from, event.destination),
          logTrigger: outcomeTrigger("T-8"),
        });
      }
      // attended — T-6 / P-5: destination choice is MANDATORY
      if (!event.destination) {
        return reject("destination_required", "Attended meeting: a destination stage is required");
      }
      const destinations = config.attendedDestinations(ctx.role);
      if (!destinations.includes(event.destination)) {
        if (event.destination === config.wonStage && !canSetWon(config, ctx)) {
          return reject("won_forbidden", "Only an admin can move a lead to Won");
        }
        return reject("destination_invalid", `"${event.destination}" is not a valid destination`);
      }
      const attendedTrigger =
        config.kind === "internal"
          ? "T-6"
          : config.kind === "partners"
            ? (config.triggers?.generic ?? "PP-3")
            : event.destination === config.wonStage
              ? "B-9" // attended → confirm win (V2 §4)
              : "B-7";
      return ok({
        fromStage: from,
        toStage: event.destination,
        requiredGroup: requiredGroupForTarget(config, from, event.destination),
        sideEffects:
          event.destination === config.wonStage && config.wonSideEffect
            ? [config.wonSideEffect]
            : [],
        logTrigger: attendedTrigger,
        auto: true,
      });
    }

    /* ------------- new number on a Didn't-Answer partner (PP-2 — §5.3) ------------- */
    case "number_added": {
      if (!config.didntAnswerStage || from !== config.didntAnswerStage) {
        return reject(
          "event_invalid_for_stage",
          "A new number only auto-returns the card from Didn't Answer",
        );
      }
      return ok({
        fromStage: from,
        toStage: config.intakeStage,
        requiredGroup: null,
        // History: "Returned to Lead — new number added" (PP-2 / PA-2)
        logTrigger: config.triggers?.numberAdded ?? "PP-2",
        auto: true,
      });
    }

  }
}

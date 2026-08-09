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
export function followUpContextFor(
  config: PipelineConfig,
  fromStage: string,
): "initial" | "after_proposal" | "after_meeting" {
  if (config.proposalStage && fromStage === config.proposalStage) return "after_proposal";
  if (fromStage === config.meetingStage) return "after_meeting";
  return "initial";
}

/** The field group a given target stage opens (SPEC §6.2 / §7.2 / §8.2). */
function groupForStage(
  config: PipelineConfig,
  fromStage: string,
  toStage: string,
): RequiredGroup | null {
  if (toStage === config.followUpStage) {
    return { group: "follow_up", context: followUpContextFor(config, fromStage) };
  }
  if (toStage === config.meetingStage) return { group: "meeting" };
  if (config.proposalStage && toStage === config.proposalStage) return { group: "proposal" };
  if (toStage === config.lostStage) return { group: "lost" };
  if (config.negotiationStage && toStage === config.negotiationStage) {
    return { group: "negotiation" }; // V2 — a note entry
  }
  if (toStage === config.wonStage) return config.wonRequiredGroup;
  if (config.didntAnswerStage && toStage === config.didntAnswerStage) {
    return { group: "numbers" }; // PP-1: reveal Number 2 / Number 3
  }
  return null; // intake stage — no group
}

/** Trigger ids per SPEC §10 rows / REQUIREMENTS-V2 (B-rows), per pipeline. */
function triggerForAction(config: PipelineConfig, toStage: string): string {
  if (config.kind === "internal") {
    if (toStage === config.followUpStage) return "T-1";
    if (toStage === config.meetingStage) return "T-2";
    if (toStage === config.proposalStage) return "T-3";
    if (toStage === config.lostStage) return "T-4";
    if (toStage === config.wonStage) return "T-9";
  }
  if (config.kind === "partners") {
    if (toStage === config.didntAnswerStage) return "PP-1";
    if (toStage === config.wonStage) return "PP-4";
    return "PP-3";
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
      const toStage = event.action;
      return ok({
        fromStage: from,
        toStage,
        requiredGroup: groupForStage(config, from, toStage),
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
      const requiredGroup = groupForStage(config, from, event.to);
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
      if (!config.proposalStage || from !== config.proposalStage) {
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
        config.kind === "internal" ? internalRow : config.kind === "partners" ? "PP-3" : "B-7";

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
        // T-8 (A-3): user picks Following Up or Lost
        if (!event.destination) {
          return reject("destination_required", "Cancelled meeting: choose Following Up or Lost");
        }
        if (event.destination !== config.followUpStage && event.destination !== config.lostStage) {
          return reject(
            "destination_invalid",
            "Cancelled meeting can only go to Following Up or Lost",
          );
        }
        return ok({
          fromStage: from,
          toStage: event.destination,
          requiredGroup: groupForStage(config, from, event.destination),
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
            ? "PP-3"
            : event.destination === config.wonStage
              ? "B-9" // attended → confirm win (V2 §4)
              : "B-7";
      return ok({
        fromStage: from,
        toStage: event.destination,
        requiredGroup: groupForStage(config, from, event.destination),
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
        logTrigger: "PP-2", // History: "Returned to Lead — new number added"
        auto: true,
      });
    }

  }
}

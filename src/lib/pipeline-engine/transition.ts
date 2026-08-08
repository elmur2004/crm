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
  if (toStage === config.wonStage) return config.wonRequiredGroup;
  if (config.didntAnswerStage && toStage === config.didntAnswerStage) {
    return { group: "numbers" }; // PP-1: reveal Number 2 / Number 3
  }
  return null; // intake stage — no group
}

function rowIdPrefix(config: PipelineConfig): "T" | "PP" | "P" {
  return config.kind === "internal" ? "T" : config.kind === "partners" ? "PP" : "P";
}

/** Trigger ids per SPEC §10 rows, resolved per pipeline. */
function triggerForAction(config: PipelineConfig, toStage: string): string {
  const p = rowIdPrefix(config);
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
  if (config.kind === "portal") {
    if (toStage === config.wonStage) return "P-6";
    return "P-3";
  }
  return `${p}-?`;
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
        logTrigger: event.to === config.wonStage ? "P-6" : "P-1",
      });
    }

    /* ------------- Proposal "Sent" checked (T-5 / P-4 — §5.3) ------------- */
    case "proposal_sent": {
      if (!config.proposalStage || from !== config.proposalStage) {
        return reject(
          "event_invalid_for_stage",
          `proposal_sent only fires from "${config.proposalStage ?? "—"}"`,
        );
      }
      return ok({
        fromStage: from,
        toStage: config.followUpStage,
        requiredGroup: { group: "follow_up", context: "after_proposal" },
        logTrigger: config.kind === "portal" ? "P-4" : "T-5",
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
        config.kind === "internal" ? internalRow : config.kind === "partners" ? "PP-3" : "P-3";

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
          return reject("won_forbidden", "Only the portal admin can move a deal to Won"); // P-5
        }
        return reject("destination_invalid", `"${event.destination}" is not a valid destination`);
      }
      const attendedTrigger =
        config.kind === "internal"
          ? "T-6"
          : config.kind === "partners"
            ? "PP-3"
            : event.destination === config.wonStage
              ? "P-6" // admin attended→Won IS the P-6 row (§10.3)
              : "P-5";
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

    /* ------------- admin moves deal to Won (P-6) ------------- */
    case "admin_won": {
      if (config.kind !== "portal") {
        return reject("event_invalid_for_stage", "admin_won is a portal event");
      }
      if (!canSetWon(config, ctx)) {
        return reject("won_forbidden", "Only the portal admin can move a deal to Won"); // P-2
      }
      return ok({
        fromStage: from,
        toStage: config.wonStage,
        requiredGroup: null, // WonDeal auto-created; admin fills values in management (§8.5.3)
        sideEffects: ["create_won_deal"],
        logTrigger: "P-6",
      });
    }
  }
}

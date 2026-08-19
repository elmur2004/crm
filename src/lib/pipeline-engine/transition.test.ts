import { describe, expect, it } from "vitest";
import { transition } from "./transition";
import { internalCrmConfig as internal } from "./configs/internal-crm";
import {
  agentsConfig as agents,
  partnersConfig as partners,
  partnersConfigFor,
} from "./configs/partners";
import { bsystemsCrmConfig as bsystems } from "./configs/bsystems-crm";
import type { EngineEvent, TransitionOk, TransitionResult } from "./types";
import { AGENT_STAGES, PARTNER_STAGES, SAME_STAGE_FORM_SLOT, type Role } from "./constants";

/* Every SPEC §10 row (v1) and REQUIREMENTS-V2 B-row has at least one test named
   after it, plus illegal-move rejections. Milestone mutations and creation flows
   are covered by the service integration tests. */

const staff: { role: Role } = { role: "byteforce_staff" };
const admin: { role: Role } = { role: "bsystems_admin" };
const sales: { role: Role } = { role: "bsystems_sales" };
const agent: { role: Role } = { role: "bsystems_agent" };
const partnerRole: { role: Role } = { role: "bsystems_partner" };

function expectOk(r: TransitionResult): TransitionOk {
  expect(r.ok).toBe(true);
  return r as TransitionOk;
}

function act(action: string): EngineEvent {
  return { type: "next_action", action };
}

describe("Internal CRM (§10.1)", () => {
  it("T-1: next action = Following up → Following Up, context per origin", () => {
    const fromNew = expectOk(transition(internal, { stage: "new" }, act("following_up"), staff));
    expect(fromNew.toStage).toBe("following_up");
    expect(fromNew.requiredGroup).toEqual({ group: "follow_up", context: "initial" });
    expect(fromNew.logTrigger).toBe("T-1");

    const fromMeeting = expectOk(
      transition(internal, { stage: "meeting_setting" }, act("following_up"), staff),
    );
    expect(fromMeeting.requiredGroup).toEqual({ group: "follow_up", context: "after_meeting" });

    const fromProposal = expectOk(
      transition(internal, { stage: "sending_proposal" }, act("following_up"), staff),
    );
    expect(fromProposal.requiredGroup).toEqual({ group: "follow_up", context: "after_proposal" });
  });

  it("T-2: next action = Meeting setting → Meeting Setting + meeting group", () => {
    const r = expectOk(transition(internal, { stage: "new" }, act("meeting_setting"), staff));
    expect(r.toStage).toBe("meeting_setting");
    expect(r.requiredGroup).toEqual({ group: "meeting" });
    expect(r.logTrigger).toBe("T-2");
  });

  it("T-3: next action = Sending proposal → Sending Proposals + proposal group", () => {
    const r = expectOk(transition(internal, { stage: "following_up" }, act("sending_proposal"), staff));
    expect(r.toStage).toBe("sending_proposal");
    expect(r.requiredGroup).toEqual({ group: "proposal" });
    expect(r.logTrigger).toBe("T-3");
  });

  it("T-4: next action = Lost → Lost + required reason group", () => {
    for (const stage of ["new", "following_up", "meeting_setting", "sending_proposal"]) {
      const r = expectOk(transition(internal, { stage }, act("lost"), staff));
      expect(r.toStage).toBe("lost");
      expect(r.requiredGroup).toEqual({ group: "lost" });
      expect(r.logTrigger).toBe("T-4");
    }
  });

  it("T-5: proposal Sent ✓ → auto-move to Following Up with after_proposal group", () => {
    const r = expectOk(transition(internal, { stage: "sending_proposal" }, { type: "proposal_sent" }, staff));
    expect(r.toStage).toBe("following_up");
    expect(r.auto).toBe(true);
    expect(r.requiredGroup).toEqual({ group: "follow_up", context: "after_proposal" });
    expect(r.logTrigger).toBe("T-5");
  });

  it("T-5 illegal: proposal_sent outside Sending Proposals is rejected", () => {
    const r = transition(internal, { stage: "following_up" }, { type: "proposal_sent" }, staff);
    expect(r.ok).toBe(false);
  });

  it("T-6: attended requires a destination; each destination opens its group", () => {
    const noDest = transition(
      internal,
      { stage: "meeting_setting" },
      { type: "meeting_outcome", outcome: "attended" },
      staff,
    );
    expect(noDest.ok).toBe(false);
    expect(!noDest.ok && noDest.code).toBe("destination_required");

    const toProposal = expectOk(
      transition(
        internal,
        { stage: "meeting_setting" },
        { type: "meeting_outcome", outcome: "attended", destination: "sending_proposal" },
        staff,
      ),
    );
    expect(toProposal.toStage).toBe("sending_proposal");
    expect(toProposal.requiredGroup).toEqual({ group: "proposal" });
    expect(toProposal.logTrigger).toBe("T-6");

    const toFollowUp = expectOk(
      transition(
        internal,
        { stage: "meeting_setting" },
        { type: "meeting_outcome", outcome: "attended", destination: "following_up" },
        staff,
      ),
    );
    expect(toFollowUp.requiredGroup).toEqual({ group: "follow_up", context: "after_meeting" });

    const toWon = expectOk(
      transition(
        internal,
        { stage: "meeting_setting" },
        { type: "meeting_outcome", outcome: "attended", destination: "won" },
        staff,
      ),
    );
    expect(toWon.requiredGroup).toEqual({ group: "won" });
    expect(toWon.sideEffects).toContain("create_client");

    const toLost = expectOk(
      transition(
        internal,
        { stage: "meeting_setting" },
        { type: "meeting_outcome", outcome: "attended", destination: "lost" },
        staff,
      ),
    );
    expect(toLost.requiredGroup).toEqual({ group: "lost" });
  });

  it("T-7: delayed → stays in Meeting Setting, requires new date & time (A-3)", () => {
    const r = expectOk(
      transition(internal, { stage: "meeting_setting" }, { type: "meeting_outcome", outcome: "delayed" }, staff),
    );
    expect(r.toStage).toBe("meeting_setting");
    expect(r.requiredGroup).toEqual({ group: "meeting_reschedule" });
    expect(r.logTrigger).toBe("T-7");
  });

  it("T-8: cancelled → Following Up or Lost only (A-3)", () => {
    const toFU = expectOk(
      transition(
        internal,
        { stage: "meeting_setting" },
        { type: "meeting_outcome", outcome: "cancelled", destination: "following_up" },
        staff,
      ),
    );
    expect(toFU.toStage).toBe("following_up");
    expect(toFU.logTrigger).toBe("T-8");

    const toLost = expectOk(
      transition(
        internal,
        { stage: "meeting_setting" },
        { type: "meeting_outcome", outcome: "cancelled", destination: "lost" },
        staff,
      ),
    );
    expect(toLost.toStage).toBe("lost");
    expect(toLost.requiredGroup).toEqual({ group: "lost" });

    const noDest = transition(
      internal,
      { stage: "meeting_setting" },
      { type: "meeting_outcome", outcome: "cancelled" },
      staff,
    );
    expect(noDest.ok).toBe(false);
    expect(!noDest.ok && noDest.code).toBe("destination_required");

    const toProposal = transition(
      internal,
      { stage: "meeting_setting" },
      { type: "meeting_outcome", outcome: "cancelled", destination: "sending_proposal" },
      staff,
    );
    expect(toProposal.ok).toBe(false);
    expect(!toProposal.ok && toProposal.code).toBe("destination_invalid");
  });

  it("T-9: Won from any active stage requires the Won group and creates a Client (A-1, ADR-011)", () => {
    for (const stage of ["new", "following_up", "meeting_setting", "sending_proposal"]) {
      const r = expectOk(transition(internal, { stage }, act("won"), staff));
      expect(r.toStage).toBe("won");
      expect(r.requiredGroup).toEqual({ group: "won" });
      expect(r.sideEffects).toEqual(["create_client"]);
      expect(r.logTrigger).toBe("T-9");
    }
  });

  it("T-10: every successful transition carries a log trigger", () => {
    const results = [
      transition(internal, { stage: "new" }, act("following_up"), staff),
      transition(internal, { stage: "sending_proposal" }, { type: "proposal_sent" }, staff),
      transition(
        internal,
        { stage: "meeting_setting" },
        { type: "meeting_outcome", outcome: "attended", destination: "won" },
        staff,
      ),
    ];
    for (const r of results) {
      const okr = expectOk(r);
      expect(okr.logTrigger).toMatch(/^T-\d+$/);
    }
  });

  it("illegal: terminal stages accept no events", () => {
    for (const stage of ["won", "lost"]) {
      const r = transition(internal, { stage }, act("following_up"), staff);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.code).toBe("terminal_stage");
    }
  });

  it("founder override of A-7 (ADR-042): drag moves like the matching action; unknown actions still rejected", () => {
    const bad = transition(internal, { stage: "new" }, act("didnt_answer"), staff);
    expect(bad.ok).toBe(false);

    const drag = expectOk(
      transition(internal, { stage: "new" }, { type: "drag", to: "following_up" }, staff),
    );
    expect(drag.toStage).toBe("following_up");
    expect(drag.requiredGroup).toEqual({ group: "follow_up", context: "initial" });
    expect(drag.logTrigger).toBe("T-1"); // drag == matching action

    /* ADR-042 addendum: back-to-intake is formless and logs the internal
       generic move id (T-0 — mirrors B-1/PP-3's fallback role). */
    const backToNew = expectOk(
      transition(internal, { stage: "following_up" }, { type: "drag", to: "new" }, staff),
    );
    expect(backToNew.toStage).toBe("new");
    expect(backToNew.requiredGroup).toBeNull();
    expect(backToNew.logTrigger).toBe("T-0");
  });
});

describe("Partners pipeline (§10.2)", () => {
  const bstaff: { role: Role } = { role: "bsystems_admin" };

  it("PP-1: Didn't answer from Lead or any active → reveals Number 2/3 fields", () => {
    for (const stage of ["lead", "following_up", "meeting_setting"]) {
      const r = expectOk(transition(partners, { stage }, act("didnt_answer"), bstaff));
      expect(r.toStage).toBe("didnt_answer");
      expect(r.requiredGroup).toEqual({ group: "numbers" });
      expect(r.logTrigger).toBe("PP-1");
    }
  });

  it("PP-2: new number saved in Didn't Answer → automatic return to Lead", () => {
    const r = expectOk(
      transition(partners, { stage: "didnt_answer" }, { type: "number_added", slot: 2 }, bstaff),
    );
    expect(r.toStage).toBe("lead");
    expect(r.auto).toBe(true);
    expect(r.logTrigger).toBe("PP-2");
  });

  it("PP-2 illegal: number_added outside Didn't Answer does not move the card", () => {
    const r = transition(partners, { stage: "lead" }, { type: "number_added", slot: 2 }, bstaff);
    expect(r.ok).toBe(false);
  });

  it("PP-3: Following up / Meeting setting / Lost behave like T-1/T-2/T-4", () => {
    const fu = expectOk(transition(partners, { stage: "lead" }, act("following_up"), bstaff));
    expect(fu.requiredGroup).toEqual({ group: "follow_up", context: "initial" });

    const meet = expectOk(transition(partners, { stage: "lead" }, act("meeting_setting"), bstaff));
    expect(meet.requiredGroup).toEqual({ group: "meeting" });

    const lost = expectOk(transition(partners, { stage: "following_up" }, act("lost"), bstaff));
    expect(lost.requiredGroup).toEqual({ group: "lost" });
  });

  it("PP-3 + ADR-010: attended destinations are Following Up / Won / Lost — no proposals stage", () => {
    const toProposal = transition(
      partners,
      { stage: "meeting_setting" },
      { type: "meeting_outcome", outcome: "attended", destination: "sending_proposal" },
      bstaff,
    );
    expect(toProposal.ok).toBe(false);

    const toWon = expectOk(
      transition(
        partners,
        { stage: "meeting_setting" },
        { type: "meeting_outcome", outcome: "attended", destination: "won" },
        bstaff,
      ),
    );
    expect(toWon.requiredGroup).toEqual({ group: "won_partner" });
    expect(toWon.sideEffects).toContain("create_partner");
    expect(toWon.logTrigger).toBe("PP-3"); // ADR-021: owning pipeline's row id

    const delayed = expectOk(
      transition(
        partners,
        { stage: "meeting_setting" },
        { type: "meeting_outcome", outcome: "delayed" },
        bstaff,
      ),
    );
    expect(delayed.logTrigger).toBe("PP-3"); // not T-7 (ADR-021)
  });

  it("PP-4: Won requires the completeness-gate group and creates a Partner", () => {
    for (const stage of ["lead", "didnt_answer", "following_up", "meeting_setting"]) {
      const r = expectOk(transition(partners, { stage }, act("won"), bstaff));
      expect(r.toStage).toBe("won");
      expect(r.requiredGroup).toEqual({ group: "won_partner" });
      expect(r.sideEffects).toEqual(["create_partner"]);
      expect(r.logTrigger).toBe("PP-4");
    }
  });

  it("partners follow-up context after meeting is after_meeting (shared T-1 rule)", () => {
    const r = expectOk(transition(partners, { stage: "meeting_setting" }, act("following_up"), bstaff));
    expect(r.requiredGroup).toEqual({ group: "follow_up", context: "after_meeting" });
  });
});

/* ---------------------------------------------------------------------------
   ADR-057 — the AGENT variant of the partners pipeline. Founder: "agents stages
   : lead , contacted , didn't answer , meeting settting , qualified , lost ,
   when he is in qualified he becomes an agent". One engine, one config family:
   `contacted` plays the followUpStage role and `qualified` plays the wonStage
   role, so every §10.2a row below runs the SAME code as its §10.2 twin.
   --------------------------------------------------------------------------- */
describe("Agents pipeline (§10.2a)", () => {
  const bstaff: { role: Role } = { role: "bsystems_admin" };

  it("the config is the founder's vocabulary in the founder's column order", () => {
    expect(agents.stages).toEqual([
      "lead",
      "contacted",
      "didnt_answer",
      "meeting_setting",
      "qualified",
      "lost",
    ]);
    expect(agents.stages).toEqual(AGENT_STAGES);
    expect(agents.terminalStages).toEqual(["qualified", "lost"]);
    expect(agents.followUpStage).toBe("contacted");
    expect(agents.wonStage).toBe("qualified");
    /* the shared slots are untouched — that is what makes this a parameterization */
    expect(agents.intakeStage).toBe("lead");
    expect(agents.meetingStage).toBe("meeting_setting");
    expect(agents.didntAnswerStage).toBe("didnt_answer");
    expect(agents.lostStage).toBe("lost");
    expect(agents.proposalStage).toBeNull();
    expect(agents.dragEnabled).toBe(true);
    expect(agents.wonRoles).toBeNull();
    expect(agents.kind).toBe("partners"); // one engine, one pipeline kind
    expect(partnersConfigFor("agent")).toBe(agents);
    expect(partnersConfigFor("partner")).toBe(partners);
    expect(partnersConfigFor("anything else")).toBe(partners);
  });

  it("PA-1: Didn't answer from Lead or any active reveals the Number 2/3 fields", () => {
    for (const stage of ["lead", "contacted", "meeting_setting"]) {
      const r = expectOk(transition(agents, { stage }, act("didnt_answer"), bstaff));
      expect(r.toStage).toBe("didnt_answer");
      expect(r.requiredGroup).toEqual({ group: "numbers" });
      expect(r.logTrigger).toBe("PA-1");
    }
  });

  it("PA-2: new number saved in Didn't Answer → automatic return to Lead", () => {
    const r = expectOk(
      transition(agents, { stage: "didnt_answer" }, { type: "number_added", slot: 2 }, bstaff),
    );
    expect(r.toStage).toBe("lead");
    expect(r.requiredGroup).toBeNull();
    expect(r.auto).toBe(true);
    expect(r.logTrigger).toBe("PA-2");
  });

  it("PA-2 illegal: number_added outside Didn't Answer does not move the card", () => {
    for (const stage of ["lead", "contacted", "meeting_setting"]) {
      expect(transition(agents, { stage }, { type: "number_added", slot: 3 }, bstaff).ok).toBe(
        false,
      );
    }
  });

  it("PA-3: Contacted / Meeting setting / Lost behave like PP-3, context per origin", () => {
    const fu = expectOk(transition(agents, { stage: "lead" }, act("contacted"), bstaff));
    expect(fu.toStage).toBe("contacted");
    expect(fu.requiredGroup).toEqual({ group: "follow_up", context: "initial" });
    expect(fu.logTrigger).toBe("PA-3");

    const afterMeeting = expectOk(
      transition(agents, { stage: "meeting_setting" }, act("contacted"), bstaff),
    );
    expect(afterMeeting.requiredGroup).toEqual({ group: "follow_up", context: "after_meeting" });

    const meet = expectOk(transition(agents, { stage: "lead" }, act("meeting_setting"), bstaff));
    expect(meet.requiredGroup).toEqual({ group: "meeting" });
    expect(meet.logTrigger).toBe("PA-3");

    for (const stage of ["lead", "contacted", "didnt_answer", "meeting_setting"]) {
      const lost = expectOk(transition(agents, { stage }, act("lost"), bstaff));
      expect(lost.toStage).toBe("lost");
      expect(lost.requiredGroup).toEqual({ group: "lost" });
      expect(lost.logTrigger).toBe("PA-3");
    }
  });

  it("PA-4: Qualified requires the agent gate and mints the account", () => {
    for (const stage of ["lead", "contacted", "didnt_answer", "meeting_setting"]) {
      const r = expectOk(transition(agents, { stage }, act("qualified"), bstaff));
      expect(r.toStage).toBe("qualified");
      expect(r.requiredGroup).toEqual({ group: "won_agent" });
      expect(r.sideEffects).toEqual(["create_agent"]);
      expect(r.logTrigger).toBe("PA-4");
    }
  });

  it("PA-4: a drag into Qualified is the same move as the action — same gate, same trigger", () => {
    const dragged = expectOk(
      transition(agents, { stage: "lead" }, { type: "drag", to: "qualified" }, bstaff),
    );
    const chosen = expectOk(transition(agents, { stage: "lead" }, act("qualified"), bstaff));
    expect(dragged.toStage).toBe(chosen.toStage);
    expect(dragged.requiredGroup).toEqual(chosen.requiredGroup);
    expect(dragged.sideEffects).toEqual(chosen.sideEffects);
    expect(dragged.logTrigger).toBe(chosen.logTrigger);
  });

  it("PA-5 + ADR-010: attended destinations are Contacted / Qualified / Lost", () => {
    expect(agents.attendedDestinations("bsystems_admin")).toEqual([
      "contacted",
      "qualified",
      "lost",
    ]);

    const toContacted = expectOk(
      transition(
        agents,
        { stage: "meeting_setting" },
        { type: "meeting_outcome", outcome: "attended", destination: "contacted" },
        bstaff,
      ),
    );
    expect(toContacted.requiredGroup).toEqual({ group: "follow_up", context: "after_meeting" });
    expect(toContacted.logTrigger).toBe("PA-3"); // ADR-021: the owning pipeline's row id

    const toQualified = expectOk(
      transition(
        agents,
        { stage: "meeting_setting" },
        { type: "meeting_outcome", outcome: "attended", destination: "qualified" },
        bstaff,
      ),
    );
    expect(toQualified.requiredGroup).toEqual({ group: "won_agent" });
    expect(toQualified.sideEffects).toContain("create_agent");

    /* no proposals stage, and the partner pipeline's own keys are not stages
       here — both must be refused */
    for (const bad of ["sending_proposal", "following_up", "won"]) {
      const r = transition(
        agents,
        { stage: "meeting_setting" },
        { type: "meeting_outcome", outcome: "attended", destination: bad },
        bstaff,
      );
      expect(r.ok).toBe(false);
    }

    const delayed = expectOk(
      transition(
        agents,
        { stage: "meeting_setting" },
        { type: "meeting_outcome", outcome: "delayed" },
        bstaff,
      ),
    );
    expect(delayed.toStage).toBe("meeting_setting");
    expect(delayed.requiredGroup).toEqual({ group: "meeting_reschedule" });
    expect(delayed.logTrigger).toBe("PA-3");

    for (const dest of ["contacted", "lost"]) {
      const cancelled = expectOk(
        transition(
          agents,
          { stage: "meeting_setting" },
          { type: "meeting_outcome", outcome: "cancelled", destination: dest },
          bstaff,
        ),
      );
      expect(cancelled.toStage).toBe(dest);
    }
    expect(
      transition(
        agents,
        { stage: "meeting_setting" },
        { type: "meeting_outcome", outcome: "cancelled", destination: "qualified" },
        bstaff,
      ).ok,
    ).toBe(false);
  });

  it("illegal: the partner vocabulary is not available on an agent card", () => {
    for (const action of ["following_up", "won"]) {
      const r = transition(agents, { stage: "lead" }, act(action), bstaff);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.code).toBe("unknown_action");
    }
    /* a card stranded on a stage this board no longer has cannot be operated */
    for (const dead of ["following_up", "won"]) {
      const r = transition(agents, { stage: dead }, act("lost"), bstaff);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.code).toBe("event_invalid_for_stage");
    }
    expect(agents.stages).not.toContain("won");
    expect(agents.stages).not.toContain("following_up");
  });

  it("qualified and lost are terminal — no further transitions, no next actions", () => {
    for (const stage of ["qualified", "lost"]) {
      const r = transition(agents, { stage }, act("contacted"), bstaff);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.code).toBe("terminal_stage");
      expect(agents.nextActions(stage, "bsystems_admin")).toEqual([]);
    }
  });

  it("same-stage records hang on the AGENT's own slots", () => {
    expect(agents.nextActions("contacted", "bsystems_admin")).toContain("follow_up_again");
    const again = expectOk(
      transition(agents, { stage: "contacted" }, act("follow_up_again"), bstaff),
    );
    expect(again.fromStage).toBe("contacted");
    expect(again.toStage).toBe("contacted");
    expect(again.requiredGroup).toEqual({ group: "follow_up", context: "initial" });
    expect(again.logTrigger).toBe("FU-AGAIN");

    const resched = expectOk(
      transition(agents, { stage: "meeting_setting" }, act("reschedule_meeting"), bstaff),
    );
    expect(resched.requiredGroup).toEqual({ group: "meeting" });
    expect(resched.logTrigger).toBe("MTG-RESCHEDULE");

    /* the same-stage form must resolve through the SLOT, never a literal key */
    expect(agents[SAME_STAGE_FORM_SLOT.follow_up_again]).toBe("contacted");
    expect(partners[SAME_STAGE_FORM_SLOT.follow_up_again]).toBe("following_up");
    expect(agents[SAME_STAGE_FORM_SLOT.reschedule_meeting]).toBe("meeting_setting");
  });
});

/* The slot-derivation refactor rewrote nextActions / attendedDestinations /
   terminalStages for BOTH kinds. This is the regression net: the partner board
   the founder did not ask us to touch must return byte-identical sets. */
describe("The partner pipeline is unchanged (§10.2 regression net)", () => {
  const bstaff: { role: Role } = { role: "bsystems_admin" };

  it("stages, terminal stages and slots are exactly what they were", () => {
    expect(partners.stages).toEqual(PARTNER_STAGES);
    expect(partners.stages).toEqual([
      "lead",
      "didnt_answer",
      "following_up",
      "meeting_setting",
      "won",
      "lost",
    ]);
    expect(partners.terminalStages).toEqual(["won", "lost"]);
    expect(partners.followUpStage).toBe("following_up");
    expect(partners.wonStage).toBe("won");
    expect(partners.wonRequiredGroup).toEqual({ group: "won_partner" });
    expect(partners.wonSideEffect).toBe("create_partner");
  });

  it("next actions and attended destinations are the exact arrays they always were", () => {
    expect(partners.nextActions("lead", bstaff.role)).toEqual([
      "didnt_answer",
      "following_up",
      "meeting_setting",
      "won",
      "lost",
    ]);
    expect(partners.nextActions("following_up", bstaff.role)).toEqual([
      "didnt_answer",
      "following_up",
      "meeting_setting",
      "won",
      "lost",
      "follow_up_again",
    ]);
    expect(partners.nextActions("meeting_setting", bstaff.role)).toEqual([
      "didnt_answer",
      "following_up",
      "meeting_setting",
      "won",
      "lost",
      "reschedule_meeting",
    ]);
    expect(partners.nextActions("won", bstaff.role)).toEqual([]);
    expect(partners.nextActions("lost", bstaff.role)).toEqual([]);
    expect(partners.attendedDestinations(bstaff.role)).toEqual(["following_up", "won", "lost"]);
  });

  it("the agent vocabulary is not available on a partner card", () => {
    for (const action of ["contacted", "qualified"]) {
      const r = transition(partners, { stage: "lead" }, act(action), bstaff);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.code).toBe("unknown_action");
    }
  });
});


describe("B-Systems unified CRM (REQUIREMENTS-V2)", () => {
  it("B-1: actions and drags move with the target group; negotiation is a stage", () => {
    const neg = expectOk(transition(bsystems, { stage: "following_up" }, act("negotiation"), agent));
    expect(neg.toStage).toBe("negotiation");
    expect(neg.requiredGroup).toEqual({ group: "negotiation" });
    expect(neg.logTrigger).toBe("B-4");

    const dragged = expectOk(
      transition(bsystems, { stage: "new" }, { type: "drag", to: "meeting_setting" }, admin),
    );
    expect(dragged.requiredGroup).toEqual({ group: "meeting" });
    expect(dragged.logTrigger).toBe("B-1"); // drag == matching action (V2 §3)
  });

  it("B-9 / won_forbidden: only admin + internal sales can confirm win; the milestone tab opens", () => {
    for (const who of [admin, sales]) {
      const r = expectOk(transition(bsystems, { stage: "negotiation" }, act("won"), who));
      expect(r.toStage).toBe("won");
      expect(r.requiredGroup).toEqual({ group: "won_deal" }); // V2 §4 milestone tab
      expect(r.sideEffects).toEqual(["create_won_deal"]);
      expect(r.logTrigger).toBe("B-9");
    }
    for (const who of [agent, partnerRole]) {
      const action = transition(bsystems, { stage: "negotiation" }, act("won"), who);
      expect(action.ok).toBe(false);
      expect(!action.ok && action.code).toBe("won_forbidden");
      const drag = transition(bsystems, { stage: "negotiation" }, { type: "drag", to: "won" }, who);
      expect(drag.ok).toBe(false);
      expect(!drag.ok && drag.code).toBe("won_forbidden");
      const dest = transition(
        bsystems,
        { stage: "meeting_setting" },
        { type: "meeting_outcome", outcome: "attended", destination: "won" },
        who,
      );
      expect(dest.ok).toBe(false);
      expect(!dest.ok && dest.code).toBe("won_forbidden");
    }
  });

  it("B-6: proposal sent — agents/partners auto-return with NO form; admin/sales get the after-proposal group", () => {
    for (const who of [agent, partnerRole]) {
      const r = expectOk(transition(bsystems, { stage: "sending_proposal" }, { type: "proposal_sent" }, who));
      expect(r.toStage).toBe("following_up");
      expect(r.requiredGroup).toBeNull(); // V2 §3 — no questions asked
      expect(r.auto).toBe(true);
    }
    for (const who of [admin, sales]) {
      const r = expectOk(transition(bsystems, { stage: "sending_proposal" }, { type: "proposal_sent" }, who));
      expect(r.requiredGroup).toEqual({ group: "follow_up", context: "after_proposal" });
    }
  });

  it("B-7: meeting outcomes — attended destinations include negotiation; Won only for admin/sales", () => {
    expect(bsystems.attendedDestinations(admin.role)).toContain("won");
    expect(bsystems.attendedDestinations(agent.role)).not.toContain("won");
    expect(bsystems.attendedDestinations(agent.role)).toContain("negotiation");

    const toNeg = expectOk(
      transition(
        bsystems,
        { stage: "meeting_setting" },
        { type: "meeting_outcome", outcome: "attended", destination: "negotiation" },
        agent,
      ),
    );
    expect(toNeg.requiredGroup).toEqual({ group: "negotiation" });
    expect(toNeg.logTrigger).toBe("B-7");

    const delayed = expectOk(
      transition(bsystems, { stage: "meeting_setting" }, { type: "meeting_outcome", outcome: "delayed" }, agent),
    );
    expect(delayed.requiredGroup).toEqual({ group: "meeting_reschedule" });
    expect(delayed.logTrigger).toBe("B-7");
  });

  it("terminal stages accept nothing; drag to intake needs no group", () => {
    const won = transition(bsystems, { stage: "won" }, { type: "drag", to: "new" }, admin);
    expect(won.ok).toBe(false);
    expect(!won.ok && won.code).toBe("terminal_stage");

    const toIntake = expectOk(
      transition(bsystems, { stage: "following_up" }, { type: "drag", to: "new" }, agent),
    );
    expect(toIntake.requiredGroup).toBeNull();
  });
});

/* ---------------------------------------------------------------------------
   Founder: same-stage records — "another follow-up" inside Following Up, the
   negotiation's promised response date, and a meeting reschedule. New rows
   OUTSIDE the §10 tables (like B-RTC / no_answer), so they are named for what
   they do; the engine resolves each to the stage the card is already in.
   --------------------------------------------------------------------------- */
describe("Same-stage records (founder)", () => {
  it("follow_up_again: offered from Following Up on all three pipelines, never moves the card", () => {
    for (const [config, ctx] of [
      [internal, staff],
      [bsystems, admin],
      [partners, admin],
    ] as const) {
      expect(config.nextActions("following_up", ctx.role)).toContain("follow_up_again");
      const r = expectOk(transition(config, { stage: "following_up" }, act("follow_up_again"), ctx));
      expect(r.fromStage).toBe("following_up");
      expect(r.toStage).toBe("following_up");
      expect(r.requiredGroup).toEqual({ group: "follow_up", context: "initial" });
      expect(r.logTrigger).toBe("FU-AGAIN");
      expect(r.sideEffects).toEqual([]);
    }
  });

  it("negotiation_follow_up: B-Systems only, carries the after_negotiation context", () => {
    const r = expectOk(transition(bsystems, { stage: "negotiation" }, act("negotiation_follow_up"), admin));
    expect(r.toStage).toBe("negotiation");
    expect(r.requiredGroup).toEqual({ group: "follow_up", context: "after_negotiation" });
    expect(r.logTrigger).toBe("NEG-DUE");

    /* the internal and partners pipelines have no negotiation stage at all */
    expect(internal.nextActions("following_up", staff.role)).not.toContain("negotiation_follow_up");
    expect(partners.nextActions("following_up", admin.role)).not.toContain("negotiation_follow_up");
  });

  it("reschedule_meeting: records a NEW meeting (not T-7's in-place edit) and stays put", () => {
    for (const [config, ctx] of [
      [internal, staff],
      [bsystems, agent],
      [partners, admin],
    ] as const) {
      const r = expectOk(
        transition(config, { stage: "meeting_setting" }, act("reschedule_meeting"), ctx),
      );
      expect(r.toStage).toBe("meeting_setting");
      expect(r.requiredGroup).toEqual({ group: "meeting" }); // NOT meeting_reschedule
      expect(r.logTrigger).toBe("MTG-RESCHEDULE");
    }
  });

  it("each is scoped to the stage that owns its record, and terminal stages offer none", () => {
    const early = transition(bsystems, { stage: "new" }, act("follow_up_again"), admin);
    expect(early.ok).toBe(false);
    expect(!early.ok && early.code).toBe("unknown_action");

    const wrongStage = transition(bsystems, { stage: "following_up" }, act("reschedule_meeting"), admin);
    expect(wrongStage.ok).toBe(false);

    expect(bsystems.nextActions("won", admin.role)).toEqual([]);
    expect(bsystems.nextActions("lost", admin.role)).toEqual([]);
  });
});

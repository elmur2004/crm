import { describe, expect, it } from "vitest";
import { transition } from "./transition";
import { internalCrmConfig as internal } from "./configs/internal-crm";
import { partnersConfig as partners } from "./configs/partners";
import { bsystemsCrmConfig as bsystems } from "./configs/bsystems-crm";
import type { EngineEvent, TransitionOk, TransitionResult } from "./types";
import type { Role } from "./constants";

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

import { describe, expect, it } from "vitest";
import { transition } from "./transition";
import { internalCrmConfig as internal } from "./configs/internal-crm";
import { partnersConfig as partners } from "./configs/partners";
import { portalConfig as portal } from "./configs/portal";
import type { EngineEvent, TransitionOk, TransitionResult } from "./types";
import type { Role } from "./constants";

/* Every SPEC §10 row has at least one test named after it (testing obligation in the
   pipeline-engine skill), plus illegal-move rejections. P-7/P-8 are milestone
   mutations, not stage transitions — covered by the milestones service tests
   (Phase 4); PP-5 is a creation flow — covered by services integration tests
   (Phase 2). */

const staff: { role: Role } = { role: "byteforce_staff" };
const rep: { role: Role } = { role: "portal_rep" };
const admin: { role: Role } = { role: "portal_admin" };

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

  it("illegal: unknown action and drag on internal pipeline are rejected (A-7)", () => {
    const bad = transition(internal, { stage: "new" }, act("didnt_answer"), staff);
    expect(bad.ok).toBe(false);

    const drag = transition(internal, { stage: "new" }, { type: "drag", to: "following_up" }, staff);
    expect(drag.ok).toBe(false);
    expect(!drag.ok && drag.code).toBe("drag_not_supported");
  });
});

describe("Partners pipeline (§10.2)", () => {
  const bstaff: { role: Role } = { role: "bsystems_staff" };

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

describe("Portal CRM (§10.3)", () => {
  it("P-1: rep drags to any column except Won; target group opens", () => {
    const toMeeting = expectOk(
      transition(portal, { stage: "leads" }, { type: "drag", to: "meeting_setting" }, rep),
    );
    expect(toMeeting.toStage).toBe("meeting_setting");
    expect(toMeeting.requiredGroup).toEqual({ group: "meeting" });
    expect(toMeeting.logTrigger).toBe("P-1");

    const backToLeads = expectOk(
      transition(portal, { stage: "following_up" }, { type: "drag", to: "leads" }, rep),
    );
    expect(backToLeads.requiredGroup).toBeNull();

    const dragToFU = expectOk(
      transition(portal, { stage: "proposal_sending" }, { type: "drag", to: "following_up" }, rep),
    );
    expect(dragToFU.requiredGroup).toEqual({ group: "follow_up", context: "after_proposal" });
  });

  it("P-2: rep cannot reach Won by drag, action, or attended destination — server-side", () => {
    const drag = transition(portal, { stage: "proposal_sending" }, { type: "drag", to: "won" }, rep);
    expect(drag.ok).toBe(false);
    expect(!drag.ok && drag.code).toBe("won_forbidden");

    const action = transition(portal, { stage: "proposal_sending" }, act("won"), rep);
    expect(action.ok).toBe(false);
    expect(!action.ok && action.code).toBe("won_forbidden");

    const dest = transition(
      portal,
      { stage: "meeting_setting" },
      { type: "meeting_outcome", outcome: "attended", destination: "won" },
      rep,
    );
    expect(dest.ok).toBe(false);
    expect(!dest.ok && dest.code).toBe("won_forbidden");

    const adminWon = transition(portal, { stage: "leads" }, { type: "admin_won" }, rep);
    expect(adminWon.ok).toBe(false);
    expect(!adminWon.ok && adminWon.code).toBe("won_forbidden");
  });

  it("P-3: rep next actions mirror T-1…T-4 with the portal stage set", () => {
    const fu = expectOk(transition(portal, { stage: "leads" }, act("following_up"), rep));
    expect(fu.requiredGroup).toEqual({ group: "follow_up", context: "initial" });

    const prop = expectOk(transition(portal, { stage: "following_up" }, act("proposal_sending"), rep));
    expect(prop.requiredGroup).toEqual({ group: "proposal" });

    const lost = expectOk(transition(portal, { stage: "leads" }, act("lost"), rep));
    expect(lost.requiredGroup).toEqual({ group: "lost" });
    expect(lost.logTrigger).toBe("P-3");
  });

  it("P-4: proposal Sent ✓ → auto Following Up with after_proposal group", () => {
    const r = expectOk(transition(portal, { stage: "proposal_sending" }, { type: "proposal_sent" }, rep));
    expect(r.toStage).toBe("following_up");
    expect(r.auto).toBe(true);
    expect(r.requiredGroup).toEqual({ group: "follow_up", context: "after_proposal" });
    expect(r.logTrigger).toBe("P-4");
  });

  it("P-5: attended destinations exclude Won for reps, include it for admin", () => {
    const repDest = expectOk(
      transition(
        portal,
        { stage: "meeting_setting" },
        { type: "meeting_outcome", outcome: "attended", destination: "proposal_sending" },
        rep,
      ),
    );
    expect(repDest.toStage).toBe("proposal_sending");
    expect(repDest.logTrigger).toBe("P-5");

    const adminWon = expectOk(
      transition(
        portal,
        { stage: "meeting_setting" },
        { type: "meeting_outcome", outcome: "attended", destination: "won" },
        admin,
      ),
    );
    expect(adminWon.toStage).toBe("won");
    expect(adminWon.sideEffects).toContain("create_won_deal");
    expect(adminWon.logTrigger).toBe("P-6"); // admin attended→Won IS P-6 (§10.3)

    const repDelayed = expectOk(
      transition(
        portal,
        { stage: "meeting_setting" },
        { type: "meeting_outcome", outcome: "delayed" },
        rep,
      ),
    );
    expect(repDelayed.logTrigger).toBe("P-3"); // ADR-021: owning pipeline's row id
  });

  it("P-6: admin moves deal to Won from any stage → WonDeal auto-created, no group", () => {
    for (const stage of ["leads", "following_up", "meeting_setting", "proposal_sending"]) {
      const r = expectOk(transition(portal, { stage }, { type: "admin_won" }, admin));
      expect(r.toStage).toBe("won");
      expect(r.requiredGroup).toBeNull();
      expect(r.sideEffects).toEqual(["create_won_deal"]);
      expect(r.logTrigger).toBe("P-6");
    }

    const dragWon = expectOk(
      transition(portal, { stage: "proposal_sending" }, { type: "drag", to: "won" }, admin),
    );
    expect(dragWon.sideEffects).toEqual(["create_won_deal"]);
    expect(dragWon.logTrigger).toBe("P-6");
  });

  it("portal terminal stages accept nothing (won deals are admin-managed)", () => {
    const r = transition(portal, { stage: "won" }, { type: "drag", to: "leads" }, admin);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.code).toBe("terminal_stage");
  });
});

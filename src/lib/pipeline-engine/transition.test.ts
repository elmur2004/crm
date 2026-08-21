import { describe, expect, it } from "vitest";
import { requiredGroupFor, requiredGroupForTarget, transition } from "./transition";
import { internalCrmConfig as internal } from "./configs/internal-crm";
import {
  agentsConfig as agents,
  partnersConfig as partners,
  partnersConfigFor,
} from "./configs/partners";
import { bsystemsCrmConfig as bsystems } from "./configs/bsystems-crm";
import type { EngineEvent, TransitionOk, TransitionResult } from "./types";
import { PROSPECT_STAGES, type Role } from "./constants";

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

/* ---------------------------------------------------------------------------
   SPEC §10.2 — the ONE prospect pipeline (ADR-059). Founder: "Same stages for
   both." Partner cards and agent cards run the same seven columns on the same
   config family; the ONLY difference is what Qualified does (PP-4 creates the
   directory partner, PP-6 is a pure move). Every row below is normative.
   --------------------------------------------------------------------------- */

const bothKinds = [
  ["partner", partners],
  ["agent", agents],
] as const;

/** every stage a card can act FROM — the five non-terminal columns */
const ACTIVE = ["lead", "contacted", "didnt_answer", "meeting_setting", "waiting"] as const;

describe("Prospect pipeline (§10.2) — one stage set, both kinds", () => {
  const bstaff: { role: Role } = { role: "bsystems_admin" };

  it("the config is the founder's column order, and the two kinds share ONE array", () => {
    expect(PROSPECT_STAGES).toEqual([
      "lead",
      "contacted",
      "didnt_answer",
      "meeting_setting",
      "waiting",
      "qualified",
      "lost",
    ]);
    /* the SAME array object, not a copy: proof there is no fork (CLAUDE.md) */
    expect(partners.stages).toBe(agents.stages);
    expect(partners.stages).toBe(PROSPECT_STAGES);
    expect(partnersConfigFor("agent")).toBe(agents);
    expect(partnersConfigFor("partner")).toBe(partners);
    expect(partnersConfigFor("anything else")).toBe(partners);

    for (const [, config] of bothKinds) {
      expect(config.kind).toBe("partners"); // one engine, one pipeline kind
      expect(config.terminalStages).toEqual(["qualified", "lost"]);
      expect(config.intakeStage).toBe("lead");
      expect(config.meetingStage).toBe("meeting_setting");
      expect(config.didntAnswerStage).toBe("didnt_answer");
      expect(config.wonStage).toBe("qualified");
      expect(config.lostStage).toBe("lost");
      expect(config.proposalStage).toBeNull();
      expect(config.dragEnabled).toBe(true);
      expect(config.wonRoles).toBeNull();
      /* founder 2.1 — NO stage plays the follow-up role on this pipeline */
      expect(config.followUpStage).toBeNull();
    }
  });

  it("the two kinds differ in EXACTLY three slots — the terminal behaviour", () => {
    const differing = ["wonRequiredGroup", "wonSideEffect", "triggers"];
    for (const key of Object.keys(partners) as Array<keyof typeof partners>) {
      if (differing.includes(key as string)) continue;
      if (typeof partners[key] === "function") {
        /* functions are distinct closures per config — compare their ANSWERS */
        continue;
      }
      expect(agents[key]).toEqual(partners[key]);
    }
    expect(partners.wonRequiredGroup).toEqual({ group: "won_partner" });
    expect(agents.wonRequiredGroup).toBeNull();
    expect(partners.wonSideEffect).toBe("create_partner");
    expect(agents.wonSideEffect).toBeNull();
    expect(partners.triggers?.won).toBe("PP-4");
    expect(agents.triggers?.won).toBe("PP-6");
    /* the shared rows carry the SAME ids on both kinds */
    for (const [, config] of bothKinds) {
      expect(config.triggers?.didntAnswer).toBe("PP-1");
      expect(config.triggers?.numberAdded).toBe("PP-2");
      expect(config.triggers?.generic).toBe("PP-3");
    }
    /* and every derived set answers identically */
    for (const stage of [...ACTIVE, "qualified", "lost"]) {
      expect(agents.nextActions(stage, "bsystems_admin")).toEqual(
        partners.nextActions(stage, "bsystems_admin"),
      );
    }
    expect(agents.attendedDestinations("bsystems_admin")).toEqual(
      partners.attendedDestinations("bsystems_admin"),
    );
    expect(agents.cancelledDestinations("bsystems_admin")).toEqual(
      partners.cancelledDestinations("bsystems_admin"),
    );
  });

  it("the old split vocabularies are gone — no card can sit in following_up or won", () => {
    for (const [, config] of bothKinds) {
      expect(config.stages).not.toContain("following_up");
      expect(config.stages).not.toContain("won");
      for (const dead of ["following_up", "won"]) {
        /* a stranded card is un-actionable — which is why the data migration
           ships in the same change (ADR-059) */
        const r = transition(config, { stage: dead }, act("lost"), bstaff);
        expect(r.ok).toBe(false);
        expect(!r.ok && r.code).toBe("event_invalid_for_stage");
        const a = transition(config, { stage: "lead" }, act(dead), bstaff);
        expect(a.ok).toBe(false);
        expect(!a.ok && a.code).toBe("unknown_action");
      }
    }
  });

  it("PP-1: Didn't answer from Lead or any active → records the unanswered number(s)", () => {
    for (const [, config] of bothKinds) {
      for (const stage of ACTIVE.filter((s) => s !== "didnt_answer")) {
        const r = expectOk(transition(config, { stage }, act("didnt_answer"), bstaff));
        expect(r.toStage).toBe("didnt_answer");
        expect(r.requiredGroup).toEqual({ group: "numbers" });
        expect(r.logTrigger).toBe("PP-1");
      }
    }
  });

  it("PP-2: a new number saved in Didn't Answer → automatic return to Lead", () => {
    for (const [, config] of bothKinds) {
      const r = expectOk(
        transition(config, { stage: "didnt_answer" }, { type: "number_added", slot: 2 }, bstaff),
      );
      expect(r.toStage).toBe("lead");
      expect(r.requiredGroup).toBeNull();
      expect(r.auto).toBe(true);
      expect(r.logTrigger).toBe("PP-2");
    }
  });

  it("PP-2 illegal: number_added outside Didn't Answer does not move the card", () => {
    for (const [, config] of bothKinds) {
      for (const stage of ACTIVE.filter((s) => s !== "didnt_answer")) {
        expect(transition(config, { stage }, { type: "number_added", slot: 3 }, bstaff).ok).toBe(
          false,
        );
      }
    }
  });

  /* ---- founder 1.2: "The system should not require any additional details or
     mandatory fields when moving a lead to Contacted. This applies to both
     Agents and Partners." ---- */
  it("PP-3: Lead → Contacted asks for NOTHING, for BOTH kinds, by action or by drag", () => {
    for (const [, config] of bothKinds) {
      for (const stage of ACTIVE.filter((s) => s !== "contacted")) {
        const chosen = expectOk(transition(config, { stage }, act("contacted"), bstaff));
        expect(chosen.toStage).toBe("contacted");
        expect(chosen.requiredGroup).toBeNull();
        expect(chosen.sideEffects).toEqual([]);
        expect(chosen.logTrigger).toBe("PP-3");

        const dragged = expectOk(
          transition(config, { stage }, { type: "drag", to: "contacted" }, bstaff),
        );
        expect(dragged.requiredGroup).toBeNull();
        expect(dragged.logTrigger).toBe("PP-3");
      }
      /* the answer the UI asks for, so the drag opens no modal at all */
      expect(requiredGroupFor(config, "lead", "contacted")).toBeNull();
      expect(requiredGroupForTarget(config, "lead", "contacted")).toBeNull();
    }
  });

  it("PP-3: Meeting setting opens the meeting group; Lost opens the reason", () => {
    for (const [, config] of bothKinds) {
      for (const stage of ACTIVE.filter((s) => s !== "meeting_setting")) {
        const meet = expectOk(transition(config, { stage }, act("meeting_setting"), bstaff));
        expect(meet.requiredGroup).toEqual({ group: "meeting" });
        expect(meet.logTrigger).toBe("PP-3");
      }
      for (const stage of ACTIVE) {
        const lost = expectOk(transition(config, { stage }, act("lost"), bstaff));
        expect(lost.toStage).toBe("lost");
        expect(lost.requiredGroup).toEqual({ group: "lost" });
        expect(lost.logTrigger).toBe("PP-3");
      }
    }
  });

  it("PP-3: a drag back to Lead still needs no group", () => {
    for (const [, config] of bothKinds) {
      const r = expectOk(transition(config, { stage: "contacted" }, { type: "drag", to: "lead" }, bstaff));
      expect(r.toStage).toBe("lead");
      expect(r.requiredGroup).toBeNull();
    }
  });

  /* ---- founder 1.1: "Add a new stage called Waiting. Order: Meeting Setting
     then Waiting then Qualified." ---- */
  it("PP-5w: Waiting sits between Meeting Setting and Qualified and opens no group", () => {
    expect(PROSPECT_STAGES.indexOf("waiting")).toBe(PROSPECT_STAGES.indexOf("meeting_setting") + 1);
    expect(PROSPECT_STAGES.indexOf("qualified")).toBe(PROSPECT_STAGES.indexOf("waiting") + 1);
    for (const [, config] of bothKinds) {
      for (const stage of ACTIVE.filter((s) => s !== "waiting")) {
        const r = expectOk(transition(config, { stage }, act("waiting"), bstaff));
        expect(r.toStage).toBe("waiting");
        expect(r.requiredGroup).toBeNull();
        expect(r.sideEffects).toEqual([]);
        expect(r.logTrigger).toBe("PP-3");
      }
    }
  });

  it("PP-5w: Waiting is an ORDINARY ACTIVE stage — never terminal, always actionable", () => {
    for (const [, config] of bothKinds) {
      expect(config.terminalStages).not.toContain("waiting");
      const actions = config.nextActions("waiting", "bsystems_admin");
      expect(actions.length).toBeGreaterThan(0);
      /* every OTHER column is reachable from Waiting — forwards AND backwards */
      for (const stage of PROSPECT_STAGES) {
        if (stage === "waiting") continue;
        expect(actions).toContain(stage);
      }
      /* and the record buttons are there too, so a waiting card is not inert */
      expect(actions).toContain("follow_up_again");
    }
  });

  it("PP-5w: a Waiting card moves out in BOTH directions, each target keeping its own group", () => {
    const expected: Record<string, unknown> = {
      lead: null,
      contacted: null,
      didnt_answer: { group: "numbers" },
      meeting_setting: { group: "meeting" },
      lost: { group: "lost" },
    };
    for (const [kind, config] of bothKinds) {
      for (const [target, group] of Object.entries(expected)) {
        const r = expectOk(transition(config, { stage: "waiting" }, act(target), bstaff));
        expect(r.fromStage).toBe("waiting");
        expect(r.toStage).toBe(target);
        expect(r.requiredGroup).toEqual(group);
      }
      /* forwards into the win, with this kind's own gate */
      const qualified = expectOk(transition(config, { stage: "waiting" }, act("qualified"), bstaff));
      expect(qualified.toStage).toBe("qualified");
      expect(qualified.requiredGroup).toEqual(
        kind === "partner" ? { group: "won_partner" } : null,
      );
      /* and a round trip back into a stage it came from */
      const back = expectOk(
        transition(config, { stage: "meeting_setting" }, act("waiting"), bstaff),
      );
      expect(back.toStage).toBe("waiting");
    }
  });

  /* ---- founder 1.3: "Moving a lead to Qualified should not require creating or
     entering an email or password. This applies to both Agents and Partners." -- */
  it("PP-4: a PARTNER qualifies through the completeness gate and joins the directory", () => {
    for (const stage of ACTIVE) {
      const r = expectOk(transition(partners, { stage }, act("qualified"), bstaff));
      expect(r.toStage).toBe("qualified");
      expect(r.requiredGroup).toEqual({ group: "won_partner" });
      expect(r.sideEffects).toEqual(["create_partner"]);
      expect(r.logTrigger).toBe("PP-4");
    }
  });

  it("PP-6: an AGENT qualifies as a PURE move — no group, no credentials, no account", () => {
    for (const stage of ACTIVE) {
      const r = expectOk(transition(agents, { stage }, act("qualified"), bstaff));
      expect(r.toStage).toBe("qualified");
      expect(r.requiredGroup).toBeNull();
      expect(r.sideEffects).toEqual([]);
      expect(r.logTrigger).toBe("PP-6");
    }
    /* and the drag is the same move — it must not open a modal either */
    const dragged = expectOk(
      transition(agents, { stage: "lead" }, { type: "drag", to: "qualified" }, bstaff),
    );
    expect(dragged.requiredGroup).toBeNull();
    expect(dragged.sideEffects).toEqual([]);
    expect(dragged.logTrigger).toBe("PP-6");
    /* no config asks for the retired agent gate anywhere */
    expect(JSON.stringify(agents.wonRequiredGroup)).not.toContain("won_agent");
    /* and the answer the BOARD asks before it decides modal-or-commit is
       kind-specific: the shared columns must never tempt a caller into asking
       one config on the other kind's behalf (reviewer, Run 061). */
    for (const from of ACTIVE) {
      expect(requiredGroupForTarget(agents, from, "qualified")).toBeNull();
      expect(requiredGroupForTarget(partners, from, "qualified")).toEqual({
        group: "won_partner",
      });
    }
  });

  it("PP-4: a partner's drag into Qualified is the same move as the action", () => {
    const dragged = expectOk(
      transition(partners, { stage: "lead" }, { type: "drag", to: "qualified" }, bstaff),
    );
    const chosen = expectOk(transition(partners, { stage: "lead" }, act("qualified"), bstaff));
    expect(dragged.toStage).toBe(chosen.toStage);
    expect(dragged.requiredGroup).toEqual(chosen.requiredGroup);
    expect(dragged.sideEffects).toEqual(chosen.sideEffects);
    expect(dragged.logTrigger).toBe(chosen.logTrigger);
  });

  it("PP-3 + ADR-010: attended destinations are Contacted / Waiting / Qualified / Lost", () => {
    for (const [kind, config] of bothKinds) {
      expect(config.attendedDestinations("bsystems_admin")).toEqual([
        "contacted",
        "waiting",
        "qualified",
        "lost",
      ]);

      const toWaiting = expectOk(
        transition(
          config,
          { stage: "meeting_setting" },
          { type: "meeting_outcome", outcome: "attended", destination: "waiting" },
          bstaff,
        ),
      );
      expect(toWaiting.toStage).toBe("waiting");
      expect(toWaiting.requiredGroup).toBeNull();
      expect(toWaiting.logTrigger).toBe("PP-3"); // ADR-021: the owning pipeline's row

      const toQualified = expectOk(
        transition(
          config,
          { stage: "meeting_setting" },
          { type: "meeting_outcome", outcome: "attended", destination: "qualified" },
          bstaff,
        ),
      );
      expect(toQualified.requiredGroup).toEqual(
        kind === "partner" ? { group: "won_partner" } : null,
      );
      expect(toQualified.sideEffects).toEqual(kind === "partner" ? ["create_partner"] : []);

      /* no proposals stage, and the retired vocabulary is not a destination */
      for (const bad of ["sending_proposal", "following_up", "won"]) {
        expect(
          transition(
            config,
            { stage: "meeting_setting" },
            { type: "meeting_outcome", outcome: "attended", destination: bad },
            bstaff,
          ).ok,
        ).toBe(false);
      }
      const noDestination = transition(
        config,
        { stage: "meeting_setting" },
        { type: "meeting_outcome", outcome: "attended" },
        bstaff,
      );
      expect(noDestination.ok).toBe(false);
      expect(!noDestination.ok && noDestination.code).toBe("destination_required");
    }
  });

  it("PP-3: delayed stays put; cancelled goes to Contacted / Waiting / Lost — never Qualified", () => {
    for (const [, config] of bothKinds) {
      const delayed = expectOk(
        transition(
          config,
          { stage: "meeting_setting" },
          { type: "meeting_outcome", outcome: "delayed" },
          bstaff,
        ),
      );
      expect(delayed.toStage).toBe("meeting_setting");
      expect(delayed.requiredGroup).toEqual({ group: "meeting_reschedule" });
      expect(delayed.logTrigger).toBe("PP-3");

      expect(config.cancelledDestinations("bsystems_admin")).toEqual([
        "contacted",
        "waiting",
        "lost",
      ]);
      for (const dest of ["contacted", "waiting", "lost"]) {
        const cancelled = expectOk(
          transition(
            config,
            { stage: "meeting_setting" },
            { type: "meeting_outcome", outcome: "cancelled", destination: dest },
            bstaff,
          ),
        );
        expect(cancelled.toStage).toBe(dest);
      }
      const toQualified = transition(
        config,
        { stage: "meeting_setting" },
        { type: "meeting_outcome", outcome: "cancelled", destination: "qualified" },
        bstaff,
      );
      expect(toQualified.ok).toBe(false);
      expect(!toQualified.ok && toQualified.code).toBe("destination_invalid");
    }
  });

  it("PP-9: Qualified and Lost are terminal — no further transitions, no next actions", () => {
    for (const [, config] of bothKinds) {
      for (const stage of ["qualified", "lost"]) {
        const r = transition(config, { stage }, act("contacted"), bstaff);
        expect(r.ok).toBe(false);
        expect(!r.ok && r.code).toBe("terminal_stage");
        expect(config.nextActions(stage, "bsystems_admin")).toEqual([]);
      }
    }
  });

  /* ---- founder 2.1: "Contacted should only indicate that contact has been
     made unless an actual Follow Up task is required." ---- */
  it("PP-8: a follow-up is only ever written by the explicit action, from ANY active stage", () => {
    for (const [, config] of bothKinds) {
      for (const stage of ACTIVE) {
        expect(config.nextActions(stage, "bsystems_admin")).toContain("follow_up_again");
        const again = expectOk(transition(config, { stage }, act("follow_up_again"), bstaff));
        expect(again.fromStage).toBe(stage);
        expect(again.toStage).toBe(stage); // the card never moves
        expect(again.requiredGroup).toEqual({ group: "follow_up", context: "initial" });
        expect(again.logTrigger).toBe("FU-AGAIN");
        expect(again.sideEffects).toEqual([]);
        /* the form the UI renders comes from the ACTION, not from a stage — the
           only thing that survives followUpStage being null */
        expect(requiredGroupFor(config, stage, "follow_up_again")).toEqual({
          group: "follow_up",
          context: "initial",
        });
      }
      /* NO stage move ever opens a follow-up group any more */
      for (const from of ACTIVE) {
        for (const to of PROSPECT_STAGES) {
          const group = requiredGroupForTarget(config, from, to);
          expect(group?.group).not.toBe("follow_up");
        }
      }
      /* and the record buttons stay scoped: reschedule belongs to the meeting */
      expect(config.nextActions("meeting_setting", "bsystems_admin")).toContain(
        "reschedule_meeting",
      );
      expect(config.nextActions("lead", "bsystems_admin")).not.toContain("reschedule_meeting");
      expect(config.nextActions("lead", "bsystems_admin")).not.toContain("negotiation_follow_up");
    }
  });

  it("the next actions from every active stage are the other six columns, in board order", () => {
    for (const [, config] of bothKinds) {
      expect(config.nextActions("lead", "bsystems_admin")).toEqual([
        "contacted",
        "didnt_answer",
        "meeting_setting",
        "waiting",
        "qualified",
        "lost",
        "follow_up_again",
      ]);
      expect(config.nextActions("waiting", "bsystems_admin")).toEqual([
        "lead",
        "contacted",
        "didnt_answer",
        "meeting_setting",
        "qualified",
        "lost",
        "follow_up_again",
      ]);
      expect(config.nextActions("meeting_setting", "bsystems_admin")).toEqual([
        "lead",
        "contacted",
        "didnt_answer",
        "waiting",
        "qualified",
        "lost",
        "follow_up_again",
        "reschedule_meeting",
      ]);
    }
  });
});

/* The prospect pipeline gained a `cancelledDestinations` SLOT. The three lead
   pipelines must answer exactly what the core used to compose for them. */
describe("The lead pipelines are unchanged (§10.1 / V2 regression net)", () => {
  it("cancelled-meeting destinations are still Following Up or Lost", () => {
    for (const config of [internal, bsystems]) {
      expect(config.cancelledDestinations("bsystems_admin")).toEqual(["following_up", "lost"]);
      expect(config.cancelledDestinations("bsystems_agent")).toEqual(["following_up", "lost"]);
      expect(config.followUpStage).toBe("following_up");
    }
    const cancelled = expectOk(
      transition(
        internal,
        { stage: "meeting_setting" },
        { type: "meeting_outcome", outcome: "cancelled", destination: "following_up" },
        staff,
      ),
    );
    expect(cancelled.toStage).toBe("following_up");
    expect(cancelled.requiredGroup).toEqual({ group: "follow_up", context: "after_meeting" });
    expect(
      transition(
        internal,
        { stage: "meeting_setting" },
        { type: "meeting_outcome", outcome: "cancelled", destination: "won" },
        staff,
      ).ok,
    ).toBe(false);
  });

  it("their next actions and attended destinations are the exact arrays they were", () => {
    expect(internal.nextActions("new", staff.role)).toEqual([
      "following_up",
      "meeting_setting",
      "sending_proposal",
      "won",
      "lost",
    ]);
    expect(internal.attendedDestinations(staff.role)).toEqual([
      "sending_proposal",
      "won",
      "lost",
      "following_up",
    ]);
    expect(bsystems.attendedDestinations(admin.role)).toEqual([
      "sending_proposal",
      "negotiation",
      "lost",
      "following_up",
      "won",
    ]);
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
  it("follow_up_again: offered from Following Up on both lead pipelines, never moves the card", () => {
    /* the prospect pipeline has no Following Up stage since ADR-059 — its own
       "record a follow-up from any active stage" row is PP-8 above. */
    for (const [config, ctx] of [
      [internal, staff],
      [bsystems, admin],
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

    /* the internal and prospect pipelines have no negotiation stage at all */
    expect(internal.nextActions("following_up", staff.role)).not.toContain("negotiation_follow_up");
    expect(partners.nextActions("waiting", admin.role)).not.toContain("negotiation_follow_up");
  });

  it("reschedule_meeting: records a NEW meeting (not T-7's in-place edit) and stays put", () => {
    for (const [config, ctx] of [
      [internal, staff],
      [bsystems, agent],
      [partners, admin],
      [agents, admin],
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

import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import {
  applyLeadEvent,
  createLead,
  createLeadSchema,
  getLeadDetail,
  latestProposalValue,
} from "./leads";
import { LEAD_TYPES, LEAD_TYPE_LABELS } from "@/lib/pipeline-engine/constants";
import { leadTypeLabel } from "@/lib/i18n/dict/labels";
import { internalDashboard } from "./metrics";
import { ApiError } from "@/lib/api-error";
import type { Actor } from "./activity";

/* Service-level integration tests against the real SQLite schema — the §13
   "integration tests — automatic side effects" obligations for Apps A/B:
   T-5 auto-move, T-6 attended flow, T-7 reschedule, T-9 client auto-creation
   (A-1 mapping), activity log writes (T-10), ADR-012 metric semantics, and every
   §6.5 dashboard formula against a fixture with known expected numbers. */

const actor: Actor = { id: null, label: "Test Staff" };
const role = "byteforce_staff" as const;

async function makeLead(repId?: string) {
  return createLead(
    "byteforce",
    {
      salesRepId: repId,
      name: "Acme Foods",
      number: "0100000001",
      type: "cold_call",
    },
    actor,
  );
}

function followUpGroup() {
  return {
    group: "follow_up" as const,
    data: { date: "2026-09-01", time: "10:00", method: "call" as const },
  };
}

beforeEach(async () => {
  await resetDb();
});

describe("Lead types (founder: add an organic type)", () => {
  it("exposes the full set with a label and an Arabic translation for every member", () => {
    expect([...LEAD_TYPES]).toEqual([
      "cold_call",
      "event_data",
      "personal_connection",
      "campaign_lead",
      "organic",
    ]);
    for (const type of LEAD_TYPES) {
      expect(LEAD_TYPE_LABELS[type]).toBeTruthy();
      expect(leadTypeLabel("en", type)).toBe(LEAD_TYPE_LABELS[type]);
      expect(leadTypeLabel("ar", type)).toBeTruthy();
      expect(leadTypeLabel("ar", type)).not.toBe(LEAD_TYPE_LABELS[type]); // actually translated
    }
    expect(leadTypeLabel("en", "organic")).toBe("Organic");
  });

  it("the create schema accepts organic and the lead stores + renders it", async () => {
    expect(createLeadSchema.safeParse({ name: "Walk In", number: "0101112222", type: "organic" })
      .success).toBe(true);
    const lead = await createLead(
      "byteforce",
      { name: "Walk In", number: "0101112222", type: "organic" },
      actor,
    );
    const fresh = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(fresh.type).toBe("organic");
    expect(leadTypeLabel("en", fresh.type)).toBe("Organic");
    /* and an unknown type is still refused at the boundary */
    expect(
      createLeadSchema.safeParse({ name: "X", number: "1", type: "made_up" }).success,
    ).toBe(false);
  });
});

describe("internal CRM service transitions", () => {
  it("T-1: following_up action persists a FollowUp with initial context and logs it", async () => {
    const lead = await makeLead();
    const r = await applyLeadEvent({
      brand: "byteforce",
      leadId: lead.id,
      event: { type: "next_action", action: "following_up" },
      group: followUpGroup(),
      actor,
      role,
    });
    expect(r.toStage).toBe("following_up");

    const { lead: detail, history } = await getLeadDetail("byteforce", lead.id);
    expect(detail.stage).toBe("following_up");
    expect(detail.followUps).toHaveLength(1);
    expect(detail.followUps[0]!.context).toBe("initial");
    // 10:00 Cairo (UTC+3 in September DST) = 07:00 UTC
    expect(detail.followUps[0]!.dueAt.toISOString()).toBe("2026-09-01T07:00:00.000Z");
    const move = history.find((h) => h.trigger === "T-1");
    expect(move).toBeTruthy();
    expect(move!.fromStage).toBe("new");
    expect(move!.toStage).toBe("following_up");
  });

  it("T-4: lost requires the reason group — rejected without it", async () => {
    const lead = await makeLead();
    await expect(
      applyLeadEvent({
        brand: "byteforce",
        leadId: lead.id,
        event: { type: "next_action", action: "lost" },
        actor,
        role,
      }),
    ).rejects.toThrow(ApiError);

    await applyLeadEvent({
      brand: "byteforce",
      leadId: lead.id,
      event: { type: "next_action", action: "lost" },
      group: { group: "lost", data: { reason: "Chose a competitor" } },
      actor,
      role,
    });
    const { lead: detail } = await getLeadDetail("byteforce", lead.id);
    expect(detail.stage).toBe("lost");
    expect(detail.lostInfo[0]!.reason).toBe("Chose a competitor");
  });

  it("T-5: marking the proposal sent auto-moves to Following Up with after_proposal context, proposal retained", async () => {
    const lead = await makeLead();
    await applyLeadEvent({
      brand: "byteforce",
      leadId: lead.id,
      event: { type: "next_action", action: "sending_proposal" },
      group: {
        group: "proposal",
        data: { service: "Brand strategy", estimatedValue: 500_000_00, sent: false },
      },
      actor,
      role,
    });

    const r = await applyLeadEvent({
      brand: "byteforce",
      leadId: lead.id,
      event: { type: "proposal_sent" },
      group: followUpGroup(),
      actor,
      role,
    });
    expect(r.toStage).toBe("following_up");

    const { lead: detail, history } = await getLeadDetail("byteforce", lead.id);
    expect(detail.proposals).toHaveLength(1);
    expect(detail.proposals[0]!.sent).toBe(true);
    expect(detail.proposals[0]!.sentAt).toBeTruthy();
    expect(detail.followUps[0]!.context).toBe("after_proposal");
    const auto = history.find((h) => h.trigger === "T-5");
    expect(auto!.action).toBe("auto_transfer");
  });

  it("T-6: attended meeting transfers to the chosen destination and records the outcome", async () => {
    const lead = await makeLead();
    await applyLeadEvent({
      brand: "byteforce",
      leadId: lead.id,
      event: { type: "next_action", action: "meeting_setting" },
      group: {
        group: "meeting",
        data: { arranged: true, date: "2026-09-02", time: "14:00", mode: "online" },
      },
      actor,
      role,
    });

    await applyLeadEvent({
      brand: "byteforce",
      leadId: lead.id,
      event: { type: "meeting_outcome", outcome: "attended", destination: "sending_proposal" },
      group: { group: "proposal", data: { service: "Campaign", sent: false } },
      actor,
      role,
    });

    const { lead: detail, history } = await getLeadDetail("byteforce", lead.id);
    expect(detail.stage).toBe("sending_proposal");
    expect(detail.meetings[0]!.outcome).toBe("attended");
    expect(detail.meetings[0]!.outcomeDestination).toBe("sending_proposal");
    expect(history.find((h) => h.trigger === "T-6")).toBeTruthy();
  });

  it("T-7: delayed meeting stays and gets the new date & time, outcome reset", async () => {
    const lead = await makeLead();
    await applyLeadEvent({
      brand: "byteforce",
      leadId: lead.id,
      event: { type: "next_action", action: "meeting_setting" },
      group: {
        group: "meeting",
        data: { arranged: true, date: "2026-09-02", time: "14:00", mode: "offline" },
      },
      actor,
      role,
    });
    const r = await applyLeadEvent({
      brand: "byteforce",
      leadId: lead.id,
      event: { type: "meeting_outcome", outcome: "delayed" },
      group: { group: "meeting_reschedule", data: { date: "2026-09-09", time: "16:30" } },
      actor,
      role,
    });
    expect(r.toStage).toBe("meeting_setting");
    const { lead: detail } = await getLeadDetail("byteforce", lead.id);
    expect(detail.meetings).toHaveLength(1);
    expect(detail.meetings[0]!.outcome).toBeNull(); // pending again after reschedule
    // 16:30 Cairo (UTC+3) = 13:30 UTC
    expect(detail.meetings[0]!.datetime!.toISOString()).toBe("2026-09-09T13:30:00.000Z");
  });

  it("T-9 + A-1: winning creates WonInfo and the mapped Client card atomically", async () => {
    const lead = await makeLead();
    await applyLeadEvent({
      brand: "byteforce",
      leadId: lead.id,
      event: { type: "next_action", action: "sending_proposal" },
      group: {
        group: "proposal",
        data: { service: "Retainer marketing", estimatedValue: 800_000_00, sent: false },
      },
      actor,
      role,
    });
    await applyLeadEvent({
      brand: "byteforce",
      leadId: lead.id,
      event: { type: "next_action", action: "won" },
      group: {
        group: "won",
        data: { estimatedValue: 800_000_00, technicalOwner: "Tarek", collectedAmount: 300_000_00 },
      },
      actor,
      role,
    });

    const { lead: detail, history } = await getLeadDetail("byteforce", lead.id);
    expect(detail.stage).toBe("won");
    expect(detail.wonInfo!.estimatedValue).toBe(800_000_00);
    // A-1 mapping: name, number, service ← latest proposal, est, collected, toBeCollected = est − collected
    expect(detail.client).toBeTruthy();
    expect(detail.client!.name).toBe("Acme Foods");
    expect(detail.client!.number).toBe("0100000001");
    expect(detail.client!.service).toBe("Retainer marketing");
    expect(detail.client!.estimatedValue).toBe(800_000_00);
    expect(detail.client!.collected).toBe(300_000_00);
    expect(detail.client!.toBeCollected).toBe(500_000_00);
    expect(detail.client!.technicalOwner).toBe("Tarek");
    expect(history.find((h) => h.trigger === "T-9")).toBeTruthy();
    const clientLog = await db.activityLog.findFirst({
      where: { entityType: "client", trigger: "T-9" },
    });
    expect(clientLog).toBeTruthy();
  });

  it("terminal: no events accepted on a lost lead", async () => {
    const lead = await makeLead();
    await applyLeadEvent({
      brand: "byteforce",
      leadId: lead.id,
      event: { type: "next_action", action: "lost" },
      group: { group: "lost", data: { reason: "No budget" } },
      actor,
      role,
    });
    await expect(
      applyLeadEvent({
        brand: "byteforce",
        leadId: lead.id,
        event: { type: "next_action", action: "following_up" },
        group: followUpGroup(),
        actor,
        role,
      }),
    ).rejects.toThrow(/terminal/);
  });

  it("brand isolation: a byteforce lead is invisible to the bsystems namespace", async () => {
    const lead = await makeLead();
    await expect(
      applyLeadEvent({
        brand: "bsystems",
        leadId: lead.id,
        event: { type: "next_action", action: "following_up" },
        group: followUpGroup(),
        actor,
        role: "bsystems_admin",
      }),
    ).rejects.toThrow(/not found/i);
  });
});

describe("§6.5 dashboard formulas (fixtures with known numbers)", () => {
  it("computes every §6.5 number, ADR-012 latest-proposal rule included", async () => {
    /* Fixture:
       L1 new (no proposal)                       → pipeline +0
       L2 following_up, proposals 100 then 250    → pipeline +250 (ADR-012, no double count)
       L3 sending_proposal, proposal 400          → pipeline +400
       L4 won (est 800, collected 300)            → won value 800; client toBeCollected 500
       L5 lost                                    → lost count 1
       Expected: total 5; pipeline 650; wonValue 800; won 1; lost 1; toBeCollected 500. */
    await makeLead(); // L1

    const l2 = await makeLead();
    await applyLeadEvent({
      brand: "byteforce",
      leadId: l2.id,
      event: { type: "next_action", action: "sending_proposal" },
      group: { group: "proposal", data: { service: "A", estimatedValue: 100_00, sent: false } },
      actor,
      role,
    });
    await applyLeadEvent({
      brand: "byteforce",
      leadId: l2.id,
      event: { type: "next_action", action: "sending_proposal" },
      group: { group: "proposal", data: { service: "B", estimatedValue: 250_00, sent: false } },
      actor,
      role,
    });
    await applyLeadEvent({
      brand: "byteforce",
      leadId: l2.id,
      event: { type: "next_action", action: "following_up" },
      group: followUpGroup(),
      actor,
      role,
    });

    const l3 = await makeLead();
    await applyLeadEvent({
      brand: "byteforce",
      leadId: l3.id,
      event: { type: "next_action", action: "sending_proposal" },
      group: { group: "proposal", data: { service: "C", estimatedValue: 400_00, sent: false } },
      actor,
      role,
    });

    const l4 = await makeLead();
    await applyLeadEvent({
      brand: "byteforce",
      leadId: l4.id,
      event: { type: "next_action", action: "won" },
      group: {
        group: "won",
        data: { estimatedValue: 800_00, technicalOwner: "T", collectedAmount: 300_00 },
      },
      actor,
      role,
    });

    const l5 = await makeLead();
    await applyLeadEvent({
      brand: "byteforce",
      leadId: l5.id,
      event: { type: "next_action", action: "lost" },
      group: { group: "lost", data: { reason: "r" } },
      actor,
      role,
    });

    const d = await internalDashboard("byteforce");
    expect(d.totalLeads).toBe(5);
    expect(d.leadsPerStage["new"]).toBe(1);
    expect(d.leadsPerStage["following_up"]).toBe(1);
    expect(d.leadsPerStage["sending_proposal"]).toBe(1);
    expect(d.leadsPerStage["won"]).toBe(1);
    expect(d.leadsPerStage["lost"]).toBe(1);
    expect(d.pipelineValue).toBe(650_00); // 250 (latest of L2) + 400 (L3); L2's 100 NOT double-counted
    expect(d.wonValue).toBe(800_00);
    expect(d.wonCount).toBe(1);
    expect(d.lostCount).toBe(1);
    expect(d.toBeCollected).toBe(500_00);
  });

  it("latestProposalValue picks by createdAt, null when empty", () => {
    expect(latestProposalValue([])).toBeNull();
    expect(
      latestProposalValue([
        { estimatedValue: 100, createdAt: new Date("2026-01-01") },
        { estimatedValue: 900, createdAt: new Date("2026-02-01") },
      ]),
    ).toBe(900);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { applyLeadEvent, createLead, setArchived } from "./leads";
import { checkMilestone } from "./milestones";
import { internalDashboard } from "./metrics";
import { configForBrand } from "@/lib/pipeline-engine/configs/for-brand";
import type { Brand } from "@/lib/pipeline-engine/constants";
import type { Actor } from "./activity";

/* ADR-089 — the Home's money and stage figures, per company. The §6.5 ByteForce
   fixture lives in leads.integration.test.ts; this file pins what that one never
   reached: B-Systems wins live in WonDeal (not WonInfo), its "To be collected"
   is the open milestone value, and every stage a pipeline HAS gets a cell. */

process.env.AUTH_SECRET ??= "vitest-secret";

const admin: Actor = { id: null, label: "Test Admin" };

const WON_TAB = {
  estimatedValue: 900_000_00,
  totalCommissionPercentBp: 10_00,
  contractDate: "2026-08-01",
  milestones: [
    { label: "Discovery", value: 300_000_00, commissionValue: 30_000_00, expectedEnd: "2026-09-01" },
    { label: "Build", value: 600_000_00, commissionValue: 60_000_00, expectedEnd: "2026-12-01" },
  ],
};

let seq = 0;
function makeLead(brand: Brand) {
  return createLead(
    brand,
    { name: `Lead ${seq}`, number: `01012345${String(100 + seq++).padStart(3, "0")}`, type: "cold_call" },
    admin,
  );
}

async function winBsystems(estimatedValue = WON_TAB.estimatedValue) {
  const lead = await makeLead("bsystems");
  await applyLeadEvent({
    brand: "bsystems",
    leadId: lead.id,
    event: { type: "next_action", action: "won" },
    group: { group: "won_deal", data: { ...WON_TAB, estimatedValue } },
    actor: admin,
    role: "bsystems_admin",
  });
  return lead;
}

/** a lead parked in a stage directly — the figures read `stage`, not history */
async function leadIn(brand: Brand, stage: string) {
  const lead = await makeLead(brand);
  await db.lead.update({ where: { id: lead.id }, data: { stage } });
  return lead;
}

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

beforeEach(async () => {
  await resetDb();
  seq = 0;
});

describe("B-Systems Home money (ADR-089)", () => {
  it("counts a win confirmed through the milestone tab in Won value", async () => {
    await winBsystems();
    const d = await internalDashboard("bsystems");
    expect(d.wonCount).toBe(1);
    /* before the fix this read WonInfo, which B-Systems never writes: 0 */
    expect(d.wonValue).toBe(900_000_00);
  });

  it("keeps a pre-V2 win (WonInfo, no WonDeal) instead of dropping it", async () => {
    const legacy = await leadIn("bsystems", "won");
    await db.wonInfo.create({
      data: { leadId: legacy.id, estimatedValue: 500_000_00, technicalOwner: "T", collectedAmount: 0 },
    });
    await winBsystems();
    const d = await internalDashboard("bsystems");
    expect(d.wonCount).toBe(2);
    expect(d.wonValue).toBe(1_400_000_00);
  });

  it("counts each won lead once even if it somehow carries both records", async () => {
    const lead = await winBsystems();
    await db.wonInfo.create({
      data: { leadId: lead.id, estimatedValue: 1_00, technicalOwner: "T", collectedAmount: 0 },
    });
    expect((await internalDashboard("bsystems")).wonValue).toBe(900_000_00);
  });

  it("To be collected is the value of the milestones not yet completed", async () => {
    await winBsystems();
    expect((await internalDashboard("bsystems")).toBeCollected).toBe(900_000_00);

    const deal = await db.wonDeal.findFirstOrThrow({
      include: { milestones: { orderBy: { index: "asc" } } },
    });
    await checkMilestone(deal.milestones[0]!.id, "bsystems", admin);
    expect((await internalDashboard("bsystems")).toBeCollected).toBe(600_000_00);

    await checkMilestone(deal.milestones[1]!.id, "bsystems", admin);
    expect((await internalDashboard("bsystems")).toBeCollected).toBe(0);
  });

  it("keeps a legacy B-Systems client balance in To be collected", async () => {
    const legacy = await leadIn("bsystems", "won");
    await db.client.create({
      data: { brand: "bsystems", leadId: legacy.id, name: "Old Co", number: "0100", toBeCollected: 40_000_00 },
    });
    await winBsystems();
    expect((await internalDashboard("bsystems")).toBeCollected).toBe(940_000_00);
  });

  it("archiving a won deal drops its value and count (ADR-043) but not its open milestones", async () => {
    const lead = await winBsystems();
    await setArchived("bsystems", lead.id, true, admin);
    const d = await internalDashboard("bsystems");
    expect(d.wonCount).toBe(0);
    expect(d.wonValue).toBe(0);
    expect(d.toBeCollected).toBe(900_000_00);
  });

  it("never leaks across companies", async () => {
    await winBsystems();
    const bf = await internalDashboard("byteforce");
    expect(bf.wonValue).toBe(0);
    expect(bf.toBeCollected).toBe(0);
    expect(bf.totalLeads).toBe(0);
  });
});

describe("Leads per stage follows the company's own stages (ADR-089)", () => {
  it("B-Systems has a cell for every stage, Negotiation and Postpone included", async () => {
    expect(Object.keys((await internalDashboard("bsystems")).leadsPerStage)).toEqual([
      ...configForBrand("bsystems").stages,
    ]);
    await leadIn("bsystems", "negotiation");
    await leadIn("bsystems", "postponed");
    await makeLead("bsystems");
    const d = await internalDashboard("bsystems");
    expect(d.leadsPerStage["negotiation"]).toBe(1);
    expect(d.leadsPerStage["postponed"]).toBe(1);
    expect(sum(d.leadsPerStage)).toBe(d.totalLeads);
  });

  it("ByteForce has a Postpone cell and no Negotiation cell", async () => {
    const keys = Object.keys((await internalDashboard("byteforce")).leadsPerStage);
    expect(keys).toEqual([...configForBrand("byteforce").stages]);
    expect(keys).toContain("postponed");
    expect(keys).not.toContain("negotiation");
    await leadIn("byteforce", "postponed");
    await makeLead("byteforce");
    const d = await internalDashboard("byteforce");
    expect(d.leadsPerStage["postponed"]).toBe(1);
    expect(sum(d.leadsPerStage)).toBe(d.totalLeads);
  });
});

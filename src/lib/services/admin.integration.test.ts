import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { applyDealEvent, createDeal } from "./portal-deals";
import {
  checkMilestone,
  defineMilestones,
  uncheckMilestone,
  updateWonDealValues,
} from "./milestones";
import { adminDashboard, salesTeamTable } from "./portal-admin";
import { repWonDeals } from "./won-deals";
import { signupRep } from "./portal-reps";
import type { Actor } from "./activity";

/* §13 integration obligations for Phase 4: P-6 WonDeal auto-creation (covered in
   Phase 3 too), P-7 milestone generation + locking, P-8 check/uncheck with logs,
   and every §8.5.1 / §8.5.4 formula against fixtures with known numbers. */

const actor: Actor = { id: null, label: "Test Admin" };

async function makeRep(phone: string, name: string) {
  const cv = new File(
    [Buffer.concat([Buffer.from("%PDF-1.7 "), Buffer.alloc(256, 5)])],
    `${name}.pdf`,
  );
  const { userId } = await signupRep(
    {
      firstName: name,
      lastName: "Rep",
      phone,
      address: "1 St",
      speciality: "Sales",
      password: "password123",
      confirmPassword: "password123",
    },
    cv,
  );
  return db.portalRep.findUniqueOrThrow({ where: { userId } });
}

async function wonDealFor(repId: string, name: string) {
  const deal = await createDeal(
    repId,
    { name, position: "P", number: "0100", companyName: `${name} Co`, industry: "Tech" },
    actor,
  );
  await applyDealEvent({ dealId: deal.id, event: { type: "admin_won" }, actor, role: "portal_admin" });
  return db.wonDeal.findUniqueOrThrow({ where: { dealId: deal.id } });
}

beforeEach(async () => {
  await resetDb();
});

describe("Milestones (P-7 / P-8)", () => {
  it("P-7: defining N milestones generates N ordered checkboxes; A-11 warning is non-blocking", async () => {
    const rep = await makeRep("01066601001", "Mona");
    const wonDeal = await wonDealFor(rep.id, "DealOne");
    await updateWonDealValues(wonDeal.id, { estimatedValue: 100_00, totalCommission: 10_00 }, actor);

    const { warning } = await defineMilestones(wonDeal.id, { values: [40_00, 30_00, 20_00] }, actor);
    expect(warning).toMatch(/do not sum/); // 90 ≠ 100 — warned, NOT blocked (A-11)

    const milestones = await db.milestone.findMany({
      where: { wonDealId: wonDeal.id },
      orderBy: { index: "asc" },
    });
    expect(milestones.map((m) => [m.index, m.value, m.completed])).toEqual([
      [1, 40_00, false],
      [2, 30_00, false],
      [3, 20_00, false],
    ]);
    const log = await db.activityLog.findFirst({
      where: { entityType: "won_deal", entityId: wonDeal.id, action: "milestone_define" },
    });
    expect(log?.trigger).toBe("P-7");
  });

  it("P-8: sequential check unlocks the next for the rep; uncheck is logged and ordered", async () => {
    const rep = await makeRep("01066601002", "Nour");
    const wonDeal = await wonDealFor(rep.id, "DealTwo");
    await defineMilestones(wonDeal.id, { values: [50_00, 50_00] }, actor);
    const [m1, m2] = await db.milestone.findMany({
      where: { wonDealId: wonDeal.id },
      orderBy: { index: "asc" },
    });

    /* Cannot check m2 before m1 (the lock order is server-enforced). */
    await expect(checkMilestone(m2!.id, actor)).rejects.toThrow(/previous milestone/);

    await checkMilestone(m1!.id, actor);
    let view = await repWonDeals(rep.id);
    expect(view[0]!.milestones.map((m) => [m.index, m.locked, m.value])).toEqual([
      [1, false, 50_00],
      [2, false, 50_00], // unlocked by checking m1 — value now visible
    ]);
    const checkLog = await db.activityLog.findFirst({
      where: { entityId: wonDeal.id, action: "milestone_check" },
    });
    expect(checkLog?.trigger).toBe("P-8");

    /* Uncheck (ADR-020's sanctioned correction) re-locks m2 and is logged. */
    await uncheckMilestone(m1!.id, actor);
    view = await repWonDeals(rep.id);
    expect(view[0]!.milestones.map((m) => [m.index, m.locked])).toEqual([
      [1, false],
      [2, true],
    ]);
    const uncheckLog = await db.activityLog.findFirst({
      where: { entityId: wonDeal.id, action: "milestone_uncheck" },
    });
    expect(uncheckLog?.trigger).toBe("P-8");

    /* Cannot uncheck m1 while m2 is completed. */
    await checkMilestone(m1!.id, actor);
    await checkMilestone(m2!.id, actor);
    await expect(uncheckMilestone(m1!.id, actor)).rejects.toThrow(/later milestone/);
  });

  it("P-7: redefinition blocked once a milestone is checked", async () => {
    const rep = await makeRep("01066601003", "Hala");
    const wonDeal = await wonDealFor(rep.id, "DealThree");
    await defineMilestones(wonDeal.id, { values: [10_00] }, actor);
    const m = await db.milestone.findFirstOrThrow({ where: { wonDealId: wonDeal.id } });
    await checkMilestone(m.id, actor);
    await expect(defineMilestones(wonDeal.id, { values: [5_00, 5_00] }, actor)).rejects.toThrow(
      /in progress/,
    );
  });
});

describe("§8.5.1 dashboard + §8.5.4 sales team (fixtures with known numbers)", () => {
  it("computes every admin formula", async () => {
    /* Fixture:
       RepA: D1 leads (proposal 200), D2 won (est 1000, commission 100, from proposal 300)
       RepB: D3 following_up (no proposal)
       Expect: totalLeads 3; totalEstimatedValue 200 + 1000 + 0 = 1200;
               wonDeals 1; totalCommissions 100.
       Sales team: A → 2 leads, won 1, wonValue 1000, commission 100; B → 1 lead. */
    const repA = await makeRep("01066602001", "Aya");
    const repB = await makeRep("01066602002", "Basel");

    const d1 = await createDeal(
      repA.id,
      { name: "D1", position: "P", number: "1", companyName: "C1", industry: "I" },
      actor,
    );
    await applyDealEvent({
      dealId: d1.id,
      event: { type: "drag", to: "proposal_sending" },
      group: { group: "proposal", data: { service: "S", estimatedValue: 200_00, sent: false } },
      actor,
      role: "portal_rep",
    });
    await applyDealEvent({
      dealId: d1.id,
      event: { type: "drag", to: "leads" },
      actor,
      role: "portal_rep",
    });

    const d2 = await createDeal(
      repA.id,
      { name: "D2", position: "P", number: "2", companyName: "C2", industry: "I" },
      actor,
    );
    await applyDealEvent({
      dealId: d2.id,
      event: { type: "drag", to: "proposal_sending" },
      group: { group: "proposal", data: { service: "S", estimatedValue: 300_00, sent: false } },
      actor,
      role: "portal_rep",
    });
    await applyDealEvent({ dealId: d2.id, event: { type: "admin_won" }, actor, role: "portal_admin" });
    const wonDeal = await db.wonDeal.findUniqueOrThrow({ where: { dealId: d2.id } });
    await updateWonDealValues(wonDeal.id, { estimatedValue: 1000_00, totalCommission: 100_00 }, actor);

    const d3 = await createDeal(
      repB.id,
      { name: "D3", position: "P", number: "3", companyName: "C3", industry: "I" },
      actor,
    );
    await applyDealEvent({
      dealId: d3.id,
      event: { type: "drag", to: "following_up" },
      group: { group: "follow_up", data: { date: "2026-10-02", time: "10:00", method: "call" } },
      actor,
      role: "portal_rep",
    });

    const dash = await adminDashboard();
    expect(dash.totalLeads).toBe(3);
    expect(dash.totalEstimatedValue).toBe(1200_00); // 200 (D1 latest proposal) + 1000 (D2 WonDeal) + 0 (D3)
    expect(dash.wonDealsCount).toBe(1);
    expect(dash.totalCommissions).toBe(100_00);

    const team = await salesTeamTable();
    const rowA = team.find((r) => r.repName.startsWith("Aya"))!;
    const rowB = team.find((r) => r.repName.startsWith("Basel"))!;
    expect(rowA.totalLeads).toBe(2);
    expect(rowA.perStage["leads"]).toBe(1);
    expect(rowA.perStage["won"]).toBe(1);
    expect(rowA.wonDeals).toBe(1);
    expect(rowA.wonValue).toBe(1000_00);
    expect(rowA.totalCommission).toBe(100_00);
    expect(rowB.totalLeads).toBe(1);
    expect(rowB.perStage["following_up"]).toBe(1);
    expect(rowB.wonDeals).toBe(0);
  });
});

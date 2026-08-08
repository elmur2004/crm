import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { applyDealEvent, createDeal, getDealDetail } from "./portal-deals";
import { repWonDeals } from "./won-deals";
import { signupRep } from "./portal-reps";
import type { Actor } from "./activity";

/* §13 integration obligations for Phase 3: P-2 server-side rejection (every
   vector), P-1 drag flow, milestone redaction shape (P-7's read side), rep
   isolation, and the signup path incl. CV validation. */

const actor: Actor = { id: null, label: "Test Portal" };

async function makeRep(phone: string, name = "Rep") {
  const cv = new File(
    [Buffer.concat([Buffer.from("%PDF-1.7 "), Buffer.alloc(512, 3)])],
    `${name}.pdf`,
    { type: "application/pdf" },
  );
  const { userId } = await signupRep(
    {
      firstName: name,
      lastName: "Tester",
      phone,
      address: "1 Test St",
      speciality: "Testing",
      password: "password123",
      confirmPassword: "password123",
    },
    cv,
  );
  const rep = await db.portalRep.findUniqueOrThrow({ where: { userId } });
  return { userId, repId: rep.id };
}

function makeDeal(repId: string) {
  return createDeal(
    repId,
    {
      name: "Deal Contact",
      position: "CTO",
      number: "0100000010",
      companyName: "DealCo",
      industry: "Software",
    },
    actor,
  );
}

beforeEach(async () => {
  await resetDb();
});

describe("Portal CRM (§10.3)", () => {
  it("signup creates an active portal_rep with profile + validated CV (A-4)", async () => {
    const { userId, repId } = await makeRep("01055501000", "Signup");
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      include: { roles: true },
    });
    expect(user.active).toBe(true);
    expect(user.phone).toBe("01055501000");
    expect(user.roles.map((r) => r.role)).toEqual(["portal_rep"]);
    const cv = await db.attachment.findFirst({ where: { portalRepId: repId, kind: "cv" } });
    expect(cv).toBeTruthy();

    /* Duplicate phone rejected. */
    await expect(makeRep("01055501000", "Dup")).rejects.toThrow(/already exists/);
  });

  it("P-1: a rep's drag opens the target group and commits atomically; drop to leads needs none", async () => {
    const { repId } = await makeRep("01055501001");
    const deal = await makeDeal(repId);

    const r = await applyDealEvent({
      dealId: deal.id,
      event: { type: "drag", to: "meeting_setting" },
      group: {
        group: "meeting",
        data: { arranged: true, date: "2026-09-21", time: "15:00", mode: "online" },
      },
      actor,
      role: "portal_rep",
    });
    expect(r.toStage).toBe("meeting_setting");

    const back = await applyDealEvent({
      dealId: deal.id,
      event: { type: "drag", to: "leads" },
      actor,
      role: "portal_rep",
    });
    expect(back.toStage).toBe("leads");
    const { history } = await getDealDetail(deal.id);
    expect(history.filter((h) => h.trigger === "P-1")).toHaveLength(2);
  });

  it("P-2: EVERY rep path into Won is rejected server-side with 403", async () => {
    const { repId } = await makeRep("01055501002");
    const deal = await makeDeal(repId);

    for (const event of [
      { type: "drag", to: "won" } as const,
      { type: "next_action", action: "won" } as const,
      { type: "admin_won" } as const,
    ]) {
      await expect(
        applyDealEvent({ dealId: deal.id, event, actor, role: "portal_rep" }),
      ).rejects.toMatchObject({ status: 403 });
    }
    const fresh = await db.portalDeal.findUniqueOrThrow({ where: { id: deal.id } });
    expect(fresh.stage).toBe("leads"); // nothing moved

    /* Fourth vector: attended-meeting destination = won (P-5's exclusion). */
    await applyDealEvent({
      dealId: deal.id,
      event: { type: "drag", to: "meeting_setting" },
      group: {
        group: "meeting",
        data: { arranged: true, date: "2026-09-22", time: "11:00", mode: "online" },
      },
      actor,
      role: "portal_rep",
    });
    await expect(
      applyDealEvent({
        dealId: deal.id,
        event: { type: "meeting_outcome", outcome: "attended", destination: "won" },
        actor,
        role: "portal_rep",
      }),
    ).rejects.toMatchObject({ status: 403 });
    const afterAll = await db.portalDeal.findUniqueOrThrow({ where: { id: deal.id } });
    expect(afterAll.stage).toBe("meeting_setting"); // the won attempt didn't move it
    expect(await db.wonDeal.count()).toBe(0);
  });

  it("P-4: proposal sent auto-moves with after_proposal follow-up", async () => {
    const { repId } = await makeRep("01055501003");
    const deal = await makeDeal(repId);
    await applyDealEvent({
      dealId: deal.id,
      event: { type: "drag", to: "proposal_sending" },
      group: { group: "proposal", data: { service: "ERP rollout", estimatedValue: 900_00, sent: false } },
      actor,
      role: "portal_rep",
    });
    const r = await applyDealEvent({
      dealId: deal.id,
      event: { type: "proposal_sent" },
      group: { group: "follow_up", data: { date: "2026-09-25", time: "09:00", method: "message" } },
      actor,
      role: "portal_rep",
    });
    expect(r.toStage).toBe("following_up");
    const { deal: detail } = await getDealDetail(deal.id);
    expect(detail.proposals[0]!.sent).toBe(true);
    expect(detail.followUps[0]!.context).toBe("after_proposal");
  });

  it("P-6 (service level): admin Won creates the WonDeal exactly once", async () => {
    const { repId } = await makeRep("01055501004");
    const deal = await makeDeal(repId);
    const r = await applyDealEvent({
      dealId: deal.id,
      event: { type: "admin_won" },
      actor,
      role: "portal_admin",
    });
    expect(r.toStage).toBe("won");
    const wonDeal = await db.wonDeal.findUnique({ where: { dealId: deal.id } });
    expect(wonDeal).toBeTruthy();
    const log = await db.activityLog.findFirst({
      where: { entityType: "won_deal", entityId: wonDeal!.id, trigger: "P-6" },
    });
    expect(log).toBeTruthy();
  });

  it("milestone redaction: locked values NEVER leave the serializer (P-7 read side)", async () => {
    const { repId } = await makeRep("01055501005");
    const deal = await makeDeal(repId);
    await applyDealEvent({ dealId: deal.id, event: { type: "admin_won" }, actor, role: "portal_admin" });
    const wonDeal = await db.wonDeal.findUniqueOrThrow({ where: { dealId: deal.id } });
    await db.wonDeal.update({
      where: { id: wonDeal.id },
      data: { estimatedValue: 1_000_00, totalCommission: 100_00 },
    });
    for (const [index, value] of [
      [1, 40_00],
      [2, 30_00],
      [3, 30_00],
    ] as const) {
      await db.milestone.create({ data: { wonDealId: wonDeal.id, index, value } });
    }

    let list = await repWonDeals(repId);
    expect(list[0]!.milestones.map((m) => [m.index, m.locked, m.value])).toEqual([
      [1, false, 40_00], // milestone 1 visible immediately
      [2, true, null], // locked — value redacted
      [3, true, null],
    ]);

    /* Admin checks milestone 1 → milestone 2 unlocks, 3 stays locked. */
    await db.milestone.update({
      where: { wonDealId_index: { wonDealId: wonDeal.id, index: 1 } },
      data: { completed: true, completedAt: new Date() },
    });
    list = await repWonDeals(repId);
    expect(list[0]!.milestones.map((m) => [m.index, m.locked, m.value])).toEqual([
      [1, false, 40_00],
      [2, false, 30_00],
      [3, true, null],
    ]);
  });

  it("rep isolation: won-deals listing is scoped to the owning rep (§3)", async () => {
    const repA = await makeRep("01055501006", "RepA");
    const repB = await makeRep("01055501007", "RepB");
    const dealA = await makeDeal(repA.repId);
    await applyDealEvent({ dealId: dealA.id, event: { type: "admin_won" }, actor, role: "portal_admin" });

    expect(await repWonDeals(repA.repId)).toHaveLength(1);
    expect(await repWonDeals(repB.repId)).toHaveLength(0);
  });
});

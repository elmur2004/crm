import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import {
  byteforceOwedFromMindoo,
  clearSubService,
  setSubService,
} from "./foreign-sub-service";
import { formatMoney } from "@/lib/money";
import type { Actor } from "./activity";

/* ============================================================================
   ADR-077 — THE BYTEFORCE SUB-SERVICE, and the two currencies on one row.

   Founder: "this proposal is X amount in Saudi riyal, and then we will get this
   sub-service for ByteForce for X amount in Egyptian pounds."

   The thing most worth pinning is not that the write works — it is that the two
   amounts NEVER MEET. One row carries a riyal figure and a pound figure, and
   the day somebody adds them the number will look plausible and be meaningless.
   ========================================================================== */

const actor: Actor = { id: null, label: "Test Admin" };

async function leadWithProposal(brand: string, riyals: number) {
  const lead = await db.lead.create({
    data: { brand, ownerType: "internal", name: `${brand} lead`, number: "0100000001", type: "cold_call", stage: "sending_proposal" },
  });
  const proposal = await db.proposal.create({
    data: { leadId: lead.id, service: "Brand launch", estimatedValue: riyals },
  });
  return { lead, proposal };
}

beforeEach(async () => {
  await resetDb();
});

describe("setSubService — the admin annotates a Mindoo proposal", () => {
  it("stores the ByteForce service and its POUND amount beside Mindoo's riyals", async () => {
    const { lead, proposal } = await leadWithProposal("mindoo", 500_000_00);
    await setSubService(proposal.id, { service: "Video production", value: "40000" }, actor);

    const stored = await db.proposal.findUniqueOrThrow({ where: { id: proposal.id } });
    expect(stored.estimatedValue).toBe(500_000_00); // Mindoo's, untouched
    expect(stored.bfService).toBe("Video production");
    expect(stored.bfValue).toBe(40_000_00);

    /* the two are printed in DIFFERENT currencies off the same row — this is
       the whole feature, and the assertion that says so out loud */
    expect(formatMoney(stored.estimatedValue, "mindoo")).toBe("SAR 500,000");
    expect(formatMoney(stored.bfValue, "byteforce")).toBe("EGP 40,000");

    /* and the deal is logged against the LEAD, where a reader looks for it */
    const log = await db.activityLog.findFirst({
      where: { entityId: lead.id, trigger: "bf_sub_service_set" },
    });
    expect(log).not.toBeNull();
  });

  it("REFUSES a proposal that is not Mindoo's — 404, not 403", async () => {
    /* the whole idea is Mindoo work with a ByteForce piece inside it; a
       B-Systems proposal reaching here is a different feature nobody asked for,
       and an id the caller may not annotate is not confirmed to exist */
    const { proposal } = await leadWithProposal("bsystems", 100_000_00);
    await expect(
      setSubService(proposal.id, { service: "Anything", value: "1000" }, actor),
    ).rejects.toMatchObject({ status: 404 });

    const { proposal: bf } = await leadWithProposal("byteforce", 100_000_00);
    await expect(
      setSubService(bf.id, { service: "Anything", value: "1000" }, actor),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("replaces rather than accumulates — the founder chose exactly one", async () => {
    const { proposal } = await leadWithProposal("mindoo", 500_000_00);
    await setSubService(proposal.id, { service: "First", value: "10000" }, actor);
    await setSubService(proposal.id, { service: "Second", value: "25000" }, actor);
    const stored = await db.proposal.findUniqueOrThrow({ where: { id: proposal.id } });
    expect(stored.bfService).toBe("Second");
    expect(stored.bfValue).toBe(25_000_00);
  });

  it("clearing is not the same as zero", async () => {
    const { proposal } = await leadWithProposal("mindoo", 500_000_00);
    await setSubService(proposal.id, { service: "Design", value: "0" }, actor);
    expect((await db.proposal.findUniqueOrThrow({ where: { id: proposal.id } })).bfValue).toBe(0);

    await clearSubService(proposal.id, actor);
    const cleared = await db.proposal.findUniqueOrThrow({ where: { id: proposal.id } });
    expect(cleared.bfValue).toBeNull();
    expect(cleared.bfService).toBeNull();
  });
});

describe("byteforceOwedFromMindoo — what counts, and what does not", () => {
  it("sums the sub-services on LIVE Mindoo leads", async () => {
    const a = await leadWithProposal("mindoo", 100_000_00);
    const b = await leadWithProposal("mindoo", 200_000_00);
    await setSubService(a.proposal.id, { service: "Design", value: "10000" }, actor);
    await setSubService(b.proposal.id, { service: "Video", value: "15000" }, actor);
    expect(await byteforceOwedFromMindoo()).toBe(25_000_00);
  });

  it("a WON or LOST lead is not pipeline (§6.5), and neither is an archived one", async () => {
    const won = await leadWithProposal("mindoo", 100_000_00);
    await setSubService(won.proposal.id, { service: "Design", value: "10000" }, actor);
    await db.lead.update({ where: { id: won.lead.id }, data: { stage: "won" } });
    expect(await byteforceOwedFromMindoo()).toBe(0);

    await db.lead.update({ where: { id: won.lead.id }, data: { stage: "negotiation" } });
    expect(await byteforceOwedFromMindoo()).toBe(10_000_00);

    await db.lead.update({ where: { id: won.lead.id }, data: { archived: true } });
    expect(await byteforceOwedFromMindoo()).toBe(0);
  });

  it("counts the NEWEST proposal only, like every other lead value (ADR-012)", async () => {
    const { lead, proposal } = await leadWithProposal("mindoo", 100_000_00);
    await setSubService(proposal.id, { service: "Old quote", value: "10000" }, actor);
    const newer = await db.proposal.create({
      data: {
        leadId: lead.id,
        service: "Revised",
        estimatedValue: 150_000_00,
        createdAt: new Date(Date.now() + 60_000),
      },
    });
    await setSubService(newer.id, { service: "New quote", value: "30000" }, actor);
    /* 30,000 — not 40,000. A lead's value is its latest quote, never the sum of
       every quote it has ever had. */
    expect(await byteforceOwedFromMindoo()).toBe(30_000_00);
  });

  it("ignores B-Systems and ByteForce leads entirely", async () => {
    const bs = await leadWithProposal("bsystems", 100_000_00);
    await db.proposal.update({
      where: { id: bs.proposal.id },
      data: { bfService: "Sneaky", bfValue: 99_000_00 },
    });
    expect(await byteforceOwedFromMindoo()).toBe(0);
  });
});

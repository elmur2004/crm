import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { createLead } from "./leads";
import { adminHome, listBsLeads, listOwnLeads } from "./bsystems-admin";
import { adminWonLeads, closerWonLeads, salesWonLeads } from "./won-leads";
import type { Actor } from "./activity";

/* ============================================================================
   ADR-067 — SWITCHING COMPANY CHANGES THE DATA, and nothing else does.

   The merged CRM serves both companies from one shell, so "which rows am I
   looking at" stopped being a property of WHICH FILE the page lives in and
   became an argument the page has to pass. These tests are that argument's
   contract: every company-shaped query is asked for BOTH companies against a
   database holding BOTH, and each must return only its own.

   Written from the other direction on purpose. A test that seeds one company
   and finds its rows passes just as happily against a query with no company
   predicate at all — which is exactly the bug this file was written for
   (closerWonLeads filtered on ownerUserId alone). So every case here seeds a
   TWIN in the other company first, and the assertion that matters is the one
   about what is ABSENT.
   ========================================================================== */

const actor: Actor = { id: null, label: "Test Admin" };

let seq = 0;
function lead(brand: "bsystems" | "byteforce", name: string, opts?: { ownerType?: string; ownerUserId?: string }) {
  seq += 1;
  return createLead(
    brand,
    { name, number: `010000${String(1000 + seq)}`, type: "cold_call" },
    actor,
    opts ? { ownerType: opts.ownerType as never, ownerUserId: opts.ownerUserId } : undefined,
  );
}

async function makeUser(name: string, role: string) {
  seq += 1;
  const user = await db.user.create({
    data: { name, phone: `+2010055500${String(10 + seq)}`, passwordHash: "x" },
  });
  await db.userRole.create({ data: { userId: user.id, role } });
  return user;
}

/** A won record on ANY lead, built straight through Prisma.

    The engine cannot produce this for ByteForce — its config's win side effect
    is `create_client`, not `create_won_deal` — and that is precisely why the
    hazard has to be constructed by hand. "The wrong row cannot exist" is a
    property of today's write paths, not of the read, and the read is what
    these screens are made of. */
async function wonDealOn(leadId: string) {
  const won = await db.wonDeal.create({
    data: { leadId, estimatedValue: 500_000_00, totalCommissionPercent: 10_00 },
  });
  await db.milestone.create({
    data: { wonDealId: won.id, index: 1, label: "M1", value: 500_000_00, commissionValue: 50_000_00 },
  });
  return won;
}

beforeEach(async () => {
  await resetDb();
});

describe("the lead lists follow the company the page resolved", () => {
  it("listBsLeads returns one company's leads and never the other's", async () => {
    const bs = await lead("bsystems", "B-Systems Client");
    const bf = await lead("byteforce", "ByteForce Client");

    const forBs = await listBsLeads("bsystems", "any");
    expect(forBs.map((l) => l.id)).toEqual([bs.id]);
    expect(forBs.map((l) => l.name)).not.toContain("ByteForce Client");

    const forBf = await listBsLeads("byteforce", "any");
    expect(forBf.map((l) => l.id)).toEqual([bf.id]);
    expect(forBf.map((l) => l.name)).not.toContain("B-Systems Client");
  });

  it("every owner bucket and every filter stays inside its company", async () => {
    const agent = await makeUser("Karim Agent", "bsystems_agent");
    await lead("bsystems", "Delta Textiles", { ownerType: "agent", ownerUserId: agent.id });
    /* the same owner, the same search term, the other company */
    await lead("byteforce", "Delta Textiles", { ownerType: "agent", ownerUserId: agent.id });

    expect((await listBsLeads("bsystems", "agent")).map((l) => l.brand)).toEqual(["bsystems"]);
    expect((await listBsLeads("byteforce", "agent")).map((l) => l.brand)).toEqual(["byteforce"]);
    /* a search that matches BOTH still answers for one company only — the
       filter narrows within the company, it never reaches across it */
    expect(await listBsLeads("bsystems", "any", { search: "delta" })).toHaveLength(1);
    expect(await listBsLeads("byteforce", "any", { search: "delta" })).toHaveLength(1);
  });

  it("an owner's OWN board is scoped by company as well as by owner", async () => {
    const agent = await makeUser("Dual Owner", "bsystems_agent");
    const mineBs = await lead("bsystems", "Mine BS", { ownerType: "agent", ownerUserId: agent.id });
    const mineBf = await lead("byteforce", "Mine BF", { ownerType: "agent", ownerUserId: agent.id });

    expect((await listOwnLeads("bsystems", agent.id)).map((l) => l.id)).toEqual([mineBs.id]);
    expect((await listOwnLeads("byteforce", agent.id)).map((l) => l.id)).toEqual([mineBf.id]);
  });

  it("the admin Home's figures are the resolved company's, not both companies' summed", async () => {
    await lead("bsystems", "One");
    await lead("byteforce", "Two");
    await lead("byteforce", "Three");

    expect((await adminHome("bsystems")).base.totalLeads).toBe(1);
    expect((await adminHome("byteforce")).base.totalLeads).toBe(2);
  });
});

describe("Won Leads / commission never crosses the company line", () => {
  it("a closer's commission list refuses the other company's won deal", async () => {
    /* THE regression this file exists for. closerWonLeads used to filter on
       ownerUserId ALONE: give one person an owned lead in each company and the
       B-Systems screen handed him the ByteForce deal's money. */
    const closer = await makeUser("Cross Closer", "bsystems_agent");
    const bsLead = await lead("bsystems", "Ours", { ownerType: "agent", ownerUserId: closer.id });
    const bfLead = await lead("byteforce", "Theirs", { ownerType: "agent", ownerUserId: closer.id });
    await wonDealOn(bsLead.id);
    await wonDealOn(bfLead.id);

    const forBs = await closerWonLeads("bsystems", closer.id, { showCommission: true });
    expect(forBs.map((w) => w.lead.name)).toEqual(["Ours"]);
    expect(forBs.map((w) => w.lead.name)).not.toContain("Theirs");
    /* and the money itself, stated plainly: exactly one deal's worth */
    expect(forBs).toHaveLength(1);
  });

  it("the admin and internal-sales won lists are company-scoped too", async () => {
    const bsLead = await lead("bsystems", "BS Won");
    const bfLead = await lead("byteforce", "BF Won");
    await wonDealOn(bsLead.id);
    await wonDealOn(bfLead.id);

    expect((await adminWonLeads("bsystems")).map((w) => w.lead.name)).toEqual(["BS Won"]);
    expect((await adminWonLeads("byteforce")).map((w) => w.lead.name)).toEqual(["BF Won"]);
    /* both leads default to the internal owner bucket, so this is the sales
       view's own cross-company case, not a bucket accident */
    expect((await salesWonLeads("bsystems")).map((w) => w.lead.name)).toEqual(["BS Won"]);
    expect((await salesWonLeads("byteforce")).map((w) => w.lead.name)).toEqual(["BF Won"]);
  });
});

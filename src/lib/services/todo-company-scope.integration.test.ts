import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { cairoToUtc } from "@/lib/datetime";
import { todoFor } from "./todo";
import { setTodoDone } from "./todo-done";
import type { Actor } from "./activity";

/* ============================================================================
   ADR-067 — THE TO-DO, SWITCHED.

   Founder: "The same thing with the to do. When I go to the to do, I can switch
   this and this between byte force and b systems."

   One address, one projection, two companies — so the To-Do is asked for BOTH
   here, against a database holding both, and each answer must be its own
   company's. That covers the list, the checkbox, the Done section it moves
   into, and the marks the projection reads to build it.

   Both companies are seeded in every case, and the assertions that matter are
   about what is ABSENT: a projection that filtered by nothing would pass a
   one-company test perfectly.
   ========================================================================== */

const NOW = cairoToUtc("2026-08-20", "12:00");
const DUE = cairoToUtc("2026-08-20", "09:00");
const actor: Actor = { id: null, label: "Elmur" };

let seq = 0;
function makeLead(brand: string, name: string, stage: string) {
  seq += 1;
  return db.lead.create({
    data: { brand, name, number: `010000${String(2000 + seq)}`, type: "cold_call", stage },
  });
}

function followUp(leadId: string, dueAt = DUE) {
  return db.followUp.create({ data: { leadId, context: "initial", dueAt, method: "call" } });
}

const listFor = (brand: "bsystems" | "byteforce") =>
  todoFor({ brand, scope: { kind: "all" }, now: NOW });

beforeEach(async () => {
  await resetDb();
});

describe("the To-Do list is the switched company's", () => {
  it("shows only this company's rows, in both directions", async () => {
    const bs = await makeLead("bsystems", "B-Systems Task", "following_up");
    const bf = await makeLead("byteforce", "ByteForce Task", "following_up");
    await followUp(bs.id);
    await followUp(bf.id);

    const forBs = await listFor("bsystems");
    expect(forBs.today.map((i) => i.title)).toEqual(["B-Systems Task"]);
    expect(forBs.today.map((i) => i.title)).not.toContain("ByteForce Task");

    const forBf = await listFor("byteforce");
    expect(forBf.today.map((i) => i.title)).toEqual(["ByteForce Task"]);
    expect(forBf.today.map((i) => i.title)).not.toContain("B-Systems Task");
  });

  it("each row deep-links into the merged shell carrying its own company", async () => {
    const bs = await makeLead("bsystems", "BS", "following_up");
    const bf = await makeLead("byteforce", "BF", "following_up");
    await followUp(bs.id);
    await followUp(bf.id);

    /* the two companies keep their own lead-detail SCREENS under one shell */
    expect((await listFor("bsystems")).today[0]!.href).toBe(
      `/b-systems/crm/lead/${bs.id}?company=bsystems`,
    );
    expect((await listFor("byteforce")).today[0]!.href).toBe(
      `/b-systems/leads/lead/${bf.id}?company=byteforce`,
    );
  });

  it("a negotiating lead is a To-Do row for B-Systems and an impossibility for ByteForce", async () => {
    /* ADR-067 — the stage vocabulary comes from each company's own config now.
       Negotiation exists only in the B-Systems pipeline, so the shared
       projection must ask for it only when it is asking for B-Systems. */
    const bs = await makeLead("bsystems", "Negotiating", "negotiation");
    await followUp(bs.id);
    expect((await listFor("bsystems")).today.map((i) => i.title)).toEqual(["Negotiating"]);

    /* the same shape under ByteForce: a lead parked in a stage its pipeline
       has never had contributes nothing rather than being projected anyway */
    const bf = await makeLead("byteforce", "Impossible", "negotiation");
    await followUp(bf.id);
    expect((await listFor("byteforce")).today).toHaveLength(0);
  });
});

describe("the checkbox and the Done section stay inside one company", () => {
  it("checking a ByteForce row leaves the B-Systems list untouched", async () => {
    const bs = await makeLead("bsystems", "BS Task", "following_up");
    const bf = await makeLead("byteforce", "BF Task", "following_up");
    await followUp(bs.id);
    const bfFollowUp = await followUp(bf.id);

    await setTodoDone({
      brand: "byteforce",
      kind: "follow_up",
      recordId: bfFollowUp.id,
      done: true,
      actor,
      now: NOW,
    });

    const forBf = await listFor("byteforce");
    expect(forBf.today).toHaveLength(0);
    expect(forBf.done.map((i) => i.title)).toEqual(["BF Task"]);
    expect(forBf.done[0]!.done).toEqual({ by: "manual", name: "Elmur" });

    /* the other company's day did not move */
    const forBs = await listFor("bsystems");
    expect(forBs.today.map((i) => i.title)).toEqual(["BS Task"]);
    expect(forBs.done).toHaveLength(0);
  });

  it("refuses to check the other company's record, by id", async () => {
    const bs = await makeLead("bsystems", "BS Task", "following_up");
    const f = await followUp(bs.id);

    /* the record exists and is live — it just is not this company's */
    await expect(
      setTodoDone({ brand: "byteforce", kind: "follow_up", recordId: f.id, done: true, actor, now: NOW }),
    ).rejects.toMatchObject({ status: 404 });

    /* and nothing was written, so the B-Systems row is still to do */
    expect(await db.todoDone.count()).toBe(0);
    expect((await listFor("bsystems")).today.map((i) => i.title)).toEqual(["BS Task"]);
  });

  /* ---- ACCESS AUDIT, Run 081 (BUG-016) ------------------------------------

     The test above only ever exercised `done: true`. `done: false` deleted the
     mark by RECORD ID ALONE and never read `opts.brand`, so the brand wall both
     To-Do routes document as living in this service did not exist for half the
     endpoint. Nothing escalated — the routes' own requireLeadAccess has already
     proved the caller may touch that lead, and the money kinds are absent from
     the ByteForce route's enum — but the next caller placed in front of this
     service would have inherited an unguarded cross-company delete. Both
     directions of the wall are now asserted, plus the idempotence the uncheck
     is supposed to keep. */

  it("refuses to UNCHECK the other company's record, by id", async () => {
    const bs = await makeLead("bsystems", "BS Task", "following_up");
    const f = await followUp(bs.id);
    await setTodoDone({
      brand: "bsystems",
      kind: "follow_up",
      recordId: f.id,
      done: true,
      actor,
      now: NOW,
    });
    expect(await db.todoDone.count()).toBe(1);

    await expect(
      setTodoDone({
        brand: "byteforce",
        kind: "follow_up",
        recordId: f.id,
        done: false,
        actor,
        now: NOW,
      }),
    ).rejects.toMatchObject({ status: 404 });

    /* the mark SURVIVED — the other company could not clear it */
    expect(await db.todoDone.count()).toBe(1);
    expect((await listFor("bsystems")).done.map((i) => i.title)).toEqual(["BS Task"]);

    /* and its own company still unchecks it, as idempotently as ever */
    await setTodoDone({
      brand: "bsystems",
      kind: "follow_up",
      recordId: f.id,
      done: false,
      actor,
      now: NOW,
    });
    await setTodoDone({
      brand: "bsystems",
      kind: "follow_up",
      recordId: f.id,
      done: false,
      actor,
      now: NOW,
    });
    expect(await db.todoDone.count()).toBe(0);
  });

  it("refuses to UNCHECK a MONEY mark under the other company", async () => {
    const lead = await makeLead("bsystems", "Won One", "won");
    const won = await db.wonDeal.create({
      data: { leadId: lead.id, estimatedValue: 100_000_00, totalCommissionPercent: 10_00 },
    });
    const ms = await db.milestone.create({
      data: { wonDealId: won.id, index: 1, label: "M1", value: 100_000_00, expectedEnd: DUE },
    });
    await setTodoDone({
      brand: "bsystems",
      kind: "milestone",
      recordId: ms.id,
      done: true,
      actor,
      now: NOW,
    });
    expect(await db.todoDone.count()).toBe(1);

    await expect(
      setTodoDone({
        brand: "byteforce",
        kind: "milestone",
        recordId: ms.id,
        done: false,
        actor,
        now: NOW,
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(await db.todoDone.count()).toBe(1);
  });

  it("does not ASK for the other company's marks — the read is the contract here", async () => {
    /* The projection used to fetch every mark made today, both companies, and
       filter afterwards. Its OUTPUT was already right, because the lookup is by
       record id — which is exactly why this has to be asserted on the QUERY. A
       mark carries `completedByLabel`, the name of the colleague who ticked it;
       the right rows leaving the database is not the same thing as the wrong
       rows never being asked for. */
    const bs = await makeLead("bsystems", "BS Task", "following_up");
    const bf = await makeLead("byteforce", "BF Task", "following_up");
    const bsFollowUp = await followUp(bs.id);
    await followUp(bf.id);

    await setTodoDone({
      brand: "bsystems",
      kind: "follow_up",
      recordId: bsFollowUp.id,
      done: true,
      actor: { id: null, label: "Someone From The Other Company" },
      now: NOW,
    });

    const spy = vi.spyOn(db.todoDone, "findMany");
    const forBf = await listFor("byteforce");
    const where = spy.mock.calls[0]![0]!.where as Record<string, unknown>;
    spy.mockRestore();

    /* the day window alone would match the other company's mark */
    expect(where.OR).toBeDefined();
    expect(JSON.stringify(where)).toContain('"brand":"byteforce"');
    expect(JSON.stringify(where)).not.toContain('"brand":"bsystems"');

    /* and the money marks are not asked for at all outside their own company */
    expect(JSON.stringify(where)).not.toContain("statementId");
    expect(JSON.stringify(where)).not.toContain("milestoneId");

    expect(forBf.today.map((i) => i.title)).toEqual(["BF Task"]);
    expect(forBf.done).toHaveLength(0);
  });

});

describe("the money rows are a B-Systems subsystem and stay one", () => {
  it("statements and milestones never reach a ByteForce To-Do", async () => {
    const lead = await makeLead("bsystems", "Won One", "won");
    const won = await db.wonDeal.create({
      data: { leadId: lead.id, estimatedValue: 100_000_00, totalCommissionPercent: 10_00 },
    });
    await db.milestone.create({
      data: {
        wonDealId: won.id,
        index: 1,
        label: "M1",
        value: 100_000_00,
        expectedEnd: DUE,
      },
    });

    expect((await listFor("bsystems")).today.map((i) => i.kind)).toContain("milestone");
    expect((await listFor("byteforce")).today.map((i) => i.kind)).not.toContain("milestone");
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { applyLeadEvent, createLead, getLeadDetail } from "./leads";
import { postponeSchema } from "./groups";
import { ApiError } from "@/lib/api-error";
import type { Actor } from "./activity";
import type { Role } from "@/lib/pipeline-engine/constants";

/* ============================================================================
   ADR-072 — "Postpone / Not answering", through the service.

   Founder: "a column for all the leads that are falling out of the CRM — not
   answering, not attending the meeting, no showing… the pop up will be: is he
   not answering at all, or is he no show in the meeting, or is he not
   interested right now at all? These will be the three options, and there will
   be the option 'other' written by the user."

   The engine tests next door pin the TRANSITIONS. These pin what is written and
   what comes back: the reason row, its accumulation, the conditional
   requirement on Other, and — the property that makes it a postpone rather than
   a second Lost — that a parked lead really does come back out with its history
   intact.
   ========================================================================== */

const actor: Actor = { id: null, label: "Test Admin" };
const staff: Role = "byteforce_staff";

let seq = 0;
async function lead(brand: "byteforce" | "bsystems" = "byteforce") {
  seq += 1;
  return createLead(
    brand,
    { name: `Postpone Co ${seq}`, number: `010888${String(1000 + seq)}`, type: "cold_call" },
    actor,
  );
}

const park = (
  leadId: string,
  data: { reason: string; note?: string },
  brand: "byteforce" | "bsystems" = "byteforce",
  role: Role = staff,
) =>
  applyLeadEvent({
    brand,
    leadId,
    event: { type: "next_action", action: "postponed" },
    group: { group: "postpone", data } as never,
    actor,
    role,
  });

beforeEach(async () => {
  await resetDb();
});

describe("parking a lead", () => {
  it("moves it to Postpone and stores the reason he chose", async () => {
    const l = await lead();
    const moved = await park(l.id, { reason: "no_show" });
    expect(moved.toStage).toBe("postponed");

    const { lead: detail } = await getLeadDetail("byteforce", l.id);
    expect(detail.stage).toBe("postponed");
    expect(detail.postponeInfos).toHaveLength(1);
    expect(detail.postponeInfos[0]!.reason).toBe("no_show");
    expect(detail.postponeInfos[0]!.note).toBeNull();
  });

  it("accepts all three of his named reasons, and Other with the words he typed", async () => {
    for (const reason of ["not_answering", "no_show", "not_interested_now"] as const) {
      const l = await lead();
      await park(l.id, { reason });
      const { lead: d } = await getLeadDetail("byteforce", l.id);
      expect(d.postponeInfos[0]!.reason).toBe(reason);
    }
    const other = await lead();
    await park(other.id, { reason: "other", note: "Budget frozen until Q1" });
    const { lead: d } = await getLeadDetail("byteforce", other.id);
    expect(d.postponeInfos[0]!.reason).toBe("other");
    expect(d.postponeInfos[0]!.note).toBe("Budget frozen until Q1");
  });

  it("REFUSES the move with no group at all — the popup is not optional", async () => {
    const l = await lead();
    await expect(
      applyLeadEvent({
        brand: "byteforce",
        leadId: l.id,
        event: { type: "next_action", action: "postponed" },
        actor,
        role: staff,
      }),
    ).rejects.toThrow(ApiError);
    /* and the lead did not move: a refused transition writes nothing */
    const { lead: d } = await getLeadDetail("byteforce", l.id);
    expect(d.stage).toBe("new");
    expect(d.postponeInfos).toHaveLength(0);
  });

  it("works on the B-Systems board too, with its own roles", async () => {
    const l = await lead("bsystems");
    const moved = await park(l.id, { reason: "not_answering" }, "bsystems", "bsystems_admin");
    expect(moved.toStage).toBe("postponed");
    const { lead: d } = await getLeadDetail("bsystems", l.id);
    expect(d.postponeInfos[0]!.reason).toBe("not_answering");
  });
});

describe('"Other" has to say something', () => {
  /* The rule lives in Zod, so it holds for every caller — the form, the API and
     anything else that ever posts this group. An "Other" carrying nothing
     records that somebody pressed a button and nothing more, on the one column
     whose purpose is being able to work back through it. */
  it("rejects Other with no words, and with only whitespace", () => {
    expect(postponeSchema.safeParse({ reason: "other" }).success).toBe(false);
    expect(postponeSchema.safeParse({ reason: "other", note: "   " }).success).toBe(false);
    expect(postponeSchema.safeParse({ reason: "other", note: "Budget frozen" }).success).toBe(true);
  });

  it("leaves the three NAMED reasons free to carry a note, or not", () => {
    for (const reason of ["not_answering", "no_show", "not_interested_now"]) {
      expect(postponeSchema.safeParse({ reason }).success).toBe(true);
      expect(postponeSchema.safeParse({ reason, note: "tried twice" }).success).toBe(true);
    }
  });

  it("refuses a reason that is not one of the four", () => {
    expect(postponeSchema.safeParse({ reason: "bored" }).success).toBe(false);
  });
});

describe("it is a POSTPONE, not a second Lost", () => {
  it("comes back out to Following Up, and the reason it was parked survives", async () => {
    const l = await lead();
    await park(l.id, { reason: "not_interested_now", note: "call after Ramadan" });

    const revived = await applyLeadEvent({
      brand: "byteforce",
      leadId: l.id,
      event: { type: "next_action", action: "following_up" },
      group: {
        group: "follow_up",
        data: { date: "2026-10-01", method: "call" },
      } as never,
      actor,
      role: staff,
    });
    expect(revived.toStage).toBe("following_up");

    const { lead: d } = await getLeadDetail("byteforce", l.id);
    expect(d.stage).toBe("following_up");
    /* the park is HISTORY now, not a state — it stays on the record */
    expect(d.postponeInfos).toHaveLength(1);
    expect(d.postponeInfos[0]!.note).toBe("call after Ramadan");
    expect(d.followUps).toHaveLength(1);
  });

  it("ACCUMULATES — a lead parked twice keeps both reasons, in order (§5.2)", async () => {
    const l = await lead();
    await park(l.id, { reason: "not_answering" });
    await applyLeadEvent({
      brand: "byteforce",
      leadId: l.id,
      event: { type: "next_action", action: "following_up" },
      group: { group: "follow_up", data: { date: "2026-10-01", method: "call" } } as never,
      actor,
      role: staff,
    });
    await park(l.id, { reason: "no_show", note: "did not turn up again" });

    const { lead: d } = await getLeadDetail("byteforce", l.id);
    expect(d.stage).toBe("postponed");
    expect(d.postponeInfos.map((p) => p.reason)).toEqual(["not_answering", "no_show"]);
  });

  it("does not touch the Didn't-answer COUNTER — the two answer different questions", async () => {
    /* Founder's decision: keep both. The counter says how many times we tried;
       the column says where the lead went once we stopped trying for now. */
    const l = await lead();
    await db.lead.update({ where: { id: l.id }, data: { noAnswer: true, noAnswerCount: 3 } });
    await park(l.id, { reason: "not_answering" });

    const row = await db.lead.findUniqueOrThrow({ where: { id: l.id } });
    expect(row.stage).toBe("postponed");
    expect(row.noAnswerCount).toBe(3);
    expect(row.noAnswer).toBe(true);
  });
});

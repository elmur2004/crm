import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { applyLeadEvent, createLead, getLeadDetail } from "./leads";
import { pendingUndoFor, performUndo } from "./undo";
import { postponeSchema } from "./groups";
import type { Actor } from "./activity";
import type { Role } from "@/lib/pipeline-engine/constants";

/* ============================================================================
   ADR-072, AMENDED BY ADR-082 — "Postpone / Not answering", through the service.

   ADR-072, the founder: "a column for all the leads that are falling out of the
   CRM — not answering, not attending the meeting, no showing… the pop up will
   be: is he not answering at all, or is he no show in the meeting, or is he not
   interested right now at all? These will be the three options, and there will
   be the option 'other' written by the user."

   ADR-082, the founder, after being shown that the board's confirm-move modal
   opened EMPTY and the move could not be completed at all: "don't ask for
   anything just drop it there." The popup is withdrawn by the person who asked
   for it. So every assertion that tested the GATE is inverted below, and the
   ones that matter most are untouched: a parked lead still comes back out,
   which is the whole difference between this column and the one beside it.

   WHAT STAYS, asserted here rather than assumed: `PostponeInfo` and every row
   already in it — real history of why leads were shelved. The table simply
   stops growing.
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

/** ADR-082 — parking a lead, the way the product does it now: the action (or
    the drag), and NOTHING else on the wire. */
const park = (
  leadId: string,
  brand: "byteforce" | "bsystems" = "byteforce",
  role: Role = staff,
) =>
  applyLeadEvent({
    brand,
    leadId,
    event: { type: "next_action", action: "postponed" },
    actor,
    role,
  });

/** The pre-ADR-082 shape. Still ACCEPTED on the wire so a stale tab or an API
    caller is not 400ed — and now ignored, because the move requires no group. */
const parkWithOldPayload = (
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

const followUpTo = (leadId: string) =>
  applyLeadEvent({
    brand: "byteforce",
    leadId,
    event: { type: "next_action", action: "following_up" },
    group: { group: "follow_up", data: { date: "2026-10-01", method: "call" } } as never,
    actor,
    role: staff,
  });

beforeEach(async () => {
  await resetDb();
});

describe("parking a lead", () => {
  it("ASKS NOTHING — the action alone moves it to Postpone", async () => {
    const l = await lead();
    const moved = await park(l.id);
    expect(moved.toStage).toBe("postponed");

    const { lead: detail } = await getLeadDetail("byteforce", l.id);
    expect(detail.stage).toBe("postponed");
    /* ADR-082 — and nothing is written into the reason table any more */
    expect(detail.postponeInfos).toHaveLength(0);
  });

  it("a DRAG into the column is the same formless move (this is what was broken)", async () => {
    /* The bug he reported was a BOARD bug: the drop opened a modal with no
       fields in it. The boards ask the engine now, but the SERVICE has to
       accept a drag carrying no group or the modal-less drop just 400s
       instead. */
    const l = await lead();
    const dropped = await applyLeadEvent({
      brand: "byteforce",
      leadId: l.id,
      event: { type: "drag", to: "postponed" },
      actor,
      role: staff,
    });
    expect(dropped.toStage).toBe("postponed");
    const { lead: d } = await getLeadDetail("byteforce", l.id);
    expect(d.stage).toBe("postponed");
    expect(d.postponeInfos).toHaveLength(0);
  });

  it("an OLD client that still posts the popup's payload is accepted, not 400ed", async () => {
    /* `postponeSchema` and its union member stay, so a stale tab keeps working.
       The payload is simply ignored: with no required group, persistGroup is
       handed `null` and writes nothing. */
    const l = await lead();
    const moved = await parkWithOldPayload(l.id, { reason: "other", note: "Budget frozen" });
    expect(moved.toStage).toBe("postponed");
    const { lead: d } = await getLeadDetail("byteforce", l.id);
    expect(d.stage).toBe("postponed");
    expect(d.postponeInfos).toHaveLength(0);
  });

  it("works on the B-Systems board too, with its own roles", async () => {
    const l = await lead("bsystems");
    const moved = await park(l.id, "bsystems", "bsystems_admin");
    expect(moved.toStage).toBe("postponed");
    const { lead: d } = await getLeadDetail("bsystems", l.id);
    expect(d.stage).toBe("postponed");
  });

  it("a lead parked BEFORE ADR-082 keeps its reason, and the detail still reads it", async () => {
    /* The table stops growing; it does not get rewritten. A row written the old
       way is still the record of why that lead was shelved, and the lead detail,
       the call sheet and the prospect page all still render it (GroupHistory
       iterates `postponeInfos`, defaulting to [] — so the new empty case and the
       old populated one both render correctly). */
    const l = await lead();
    await park(l.id);
    await db.postponeInfo.create({
      data: { leadId: l.id, reason: "other", note: "Budget frozen until Q1" },
    });
    const { lead: d } = await getLeadDetail("byteforce", l.id);
    expect(d.postponeInfos).toHaveLength(1);
    expect(d.postponeInfos[0]!.reason).toBe("other");
    expect(d.postponeInfos[0]!.note).toBe("Budget frozen until Q1");
  });
});

describe('the popup\'s SCHEMA survives, because the wire shape does', () => {
  /* ADR-082 removed the form that posted this group. The schema stays: the
     group is still accepted on the wire (a stale tab must not 400), the rule is
     the one the founder dictated if he ever asks the popup back, and the stored
     reasons it describes are still rendered. Nothing in the product posts it
     today, which is why these cases exercise `postponeSchema` directly and
     claim nothing at all about a form. */
  it("still rejects Other with no words, and with only whitespace", () => {
    expect(postponeSchema.safeParse({ reason: "other" }).success).toBe(false);
    expect(postponeSchema.safeParse({ reason: "other", note: "   " }).success).toBe(false);
    expect(postponeSchema.safeParse({ reason: "other", note: "Budget frozen" }).success).toBe(true);
  });

  it("still leaves the three NAMED reasons free to carry a note, or not", () => {
    for (const reason of ["not_answering", "no_show", "not_interested_now"]) {
      expect(postponeSchema.safeParse({ reason }).success).toBe(true);
      expect(postponeSchema.safeParse({ reason, note: "tried twice" }).success).toBe(true);
    }
  });

  it("still refuses a reason that is not one of the four", () => {
    expect(postponeSchema.safeParse({ reason: "bored" }).success).toBe(false);
  });
});

describe("it is a POSTPONE, not a second Lost", () => {
  it("comes back out to Following Up, with its history intact", async () => {
    const l = await lead();
    await park(l.id);

    const revived = await followUpTo(l.id);
    expect(revived.toStage).toBe("following_up");

    const { lead: d } = await getLeadDetail("byteforce", l.id);
    expect(d.stage).toBe("following_up");
    expect(d.followUps).toHaveLength(1);
  });

  it("can be parked TWICE, and the second park is as formless as the first", async () => {
    const l = await lead();
    await park(l.id);
    await followUpTo(l.id);
    await park(l.id);

    const { lead: d } = await getLeadDetail("byteforce", l.id);
    expect(d.stage).toBe("postponed");
    expect(d.postponeInfos).toHaveLength(0);
  });

  it("does not touch the Didn't-answer COUNTER — the two answer different questions", async () => {
    /* ADR-072's own carve-out, which ADR-082 does not disturb: the counter says
       how many times we tried; the column says where the lead went once we
       stopped trying for now. The first named reason WAS "not answering at
       all", so this is the one destination that must not clear the tally. */
    const l = await lead();
    await db.lead.update({ where: { id: l.id }, data: { noAnswer: true, noAnswerCount: 3 } });
    await park(l.id);

    const row = await db.lead.findUniqueOrThrow({ where: { id: l.id } });
    expect(row.stage).toBe("postponed");
    expect(row.noAnswerCount).toBe(3);
    expect(row.noAnswer).toBe(true);
  });

  it("the formless park is still UNDOABLE — the stage comes back (ADR-045)", async () => {
    /* There is no group to restore now, which is exactly why this is asserted:
       `created` is empty and the inverse is the stage alone. */
    const user = await db.user.create({
      data: { name: "Park Undo", phone: "+201077730001", passwordHash: "x" },
    });
    const owner: Actor = { id: user.id, label: user.name };
    const l = await createLead(
      "byteforce",
      { name: "Park Undo Co", number: "0108887777", type: "cold_call" },
      owner,
    );
    await applyLeadEvent({
      brand: "byteforce",
      leadId: l.id,
      event: { type: "next_action", action: "following_up" },
      group: { group: "follow_up", data: { date: "2026-10-01", method: "call" } } as never,
      actor: owner,
      role: staff,
    });
    await applyLeadEvent({
      brand: "byteforce",
      leadId: l.id,
      event: { type: "next_action", action: "postponed" },
      actor: owner,
      role: staff,
    });
    expect((await db.lead.findUniqueOrThrow({ where: { id: l.id } })).stage).toBe("postponed");

    expect(await pendingUndoFor(owner.id!)).not.toBeNull();
    await performUndo(owner);
    expect((await db.lead.findUniqueOrThrow({ where: { id: l.id } })).stage).toBe("following_up");
    /* the follow-up the EARLIER move created is not collateral of this undo */
    expect(await db.followUp.count({ where: { leadId: l.id } })).toBe(1);
  });
});

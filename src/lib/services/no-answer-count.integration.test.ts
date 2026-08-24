import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { applyLeadEvent, createLead, setNoAnswer } from "./leads";
import { pendingUndoFor, performUndo } from "./undo";
import { listBsLeads } from "./bsystems-admin";
import type { Actor } from "./activity";

/* Founder (ADR-064): "make the didn't answer button a counter so we can know
   how many times we tried."

   The marker keeps everything ADR-039 gave it — a flag, never a stage, cleared
   by any stage move — and gains a TALLY. `noAnswer` is deliberately KEPT and
   maintained as `noAnswerCount > 0` (the backup/restore path recreates rows
   verbatim, so the column cannot be dropped), which is asserted on EVERY
   transition below: that invariant is what keeps every existing reader, filter,
   query and test working. */

let seq = 0;
async function makeUser(name = "Tally Tester") {
  const user = await db.user.create({
    data: { name, phone: `+2010777100${seq++}`, passwordHash: "x" },
  });
  return { id: user.id, label: user.name } satisfies Actor;
}

const admin: Actor = { id: null, label: "Test Admin" };

function makeLead(actor: Actor = admin) {
  return createLead(
    "bsystems",
    { name: "Tally Corp", number: "0101234567", type: "cold_call", companyName: "Tally Co" },
    actor,
  );
}

/** the pair, read fresh — and the invariant that keeps the boolean honest */
async function marker(leadId: string) {
  const l = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  expect(l.noAnswer).toBe(l.noAnswerCount > 0);
  return { noAnswer: l.noAnswer, count: l.noAnswerCount, stage: l.stage };
}

const followUp = {
  group: "follow_up" as const,
  data: { date: "2026-09-01", time: "10:00", method: "call" as const },
};

beforeEach(async () => {
  await resetDb();
});

describe('"Didn\'t answer" is a tally (ADR-064)', () => {
  it("starts at zero and counts one per press, without ever moving the card", async () => {
    const lead = await makeLead();
    expect(await marker(lead.id)).toEqual({ noAnswer: false, count: 0, stage: lead.stage });

    await setNoAnswer("bsystems", lead.id, true, admin);
    expect(await marker(lead.id)).toEqual({ noAnswer: true, count: 1, stage: lead.stage });

    await setNoAnswer("bsystems", lead.id, true, admin);
    await setNoAnswer("bsystems", lead.id, true, admin);
    expect(await marker(lead.id)).toEqual({ noAnswer: true, count: 3, stage: lead.stage });

    /* every attempt is its own activity row — the tally and the log agree */
    expect(
      await db.activityLog.count({ where: { entityId: lead.id, trigger: "no_answer" } }),
    ).toBe(3);
  });

  it("racing presses each count — two tabs on one card never lose an attempt", async () => {
    /* Review — the tally used to be a read-modify-write with the read taken
       OUTSIDE the transaction, so two presses that overlapped both read the
       same number and both wrote it back: two tries made, one try recorded,
       which is exactly the number the founder asked the card to keep. The
       board's `busy` flag is per-component and serialises nothing across a
       second tab, a phone, or a second rep on the same B-Systems board. This
       is a REAL Postgres, so these transactions really do overlap. */
    const lead = await makeLead();
    await setNoAnswer("bsystems", lead.id, true, admin); // one press already banked
    const PRESSES = 5;
    await Promise.all(
      Array.from({ length: PRESSES }, () => setNoAnswer("bsystems", lead.id, true, admin)),
    );
    expect(await marker(lead.id)).toEqual({
      noAnswer: true,
      count: 1 + PRESSES,
      stage: lead.stage,
    });
    expect(
      await db.activityLog.count({ where: { entityId: lead.id, trigger: "no_answer" } }),
    ).toBe(1 + PRESSES);
  });

  it("the Answered press resets the tally to zero, and stays idempotent from zero", async () => {
    const lead = await makeLead();
    await setNoAnswer("bsystems", lead.id, true, admin);
    await setNoAnswer("bsystems", lead.id, true, admin);
    expect((await marker(lead.id)).count).toBe(2);

    await setNoAnswer("bsystems", lead.id, false, admin);
    expect(await marker(lead.id)).toEqual({ noAnswer: false, count: 0, stage: lead.stage });

    /* ADR-039's idempotence survives: clearing a clear marker writes nothing */
    await setNoAnswer("bsystems", lead.id, false, admin);
    expect(
      await db.activityLog.count({ where: { entityId: lead.id, trigger: "no_answer_cleared" } }),
    ).toBe(1);
  });

  it("counting starts fresh after a clear — it is not resumed", async () => {
    const lead = await makeLead();
    await setNoAnswer("bsystems", lead.id, true, admin);
    await setNoAnswer("bsystems", lead.id, true, admin);
    await setNoAnswer("bsystems", lead.id, false, admin);
    await setNoAnswer("bsystems", lead.id, true, admin);
    expect((await marker(lead.id)).count).toBe(1);
  });

  it("a stage move clears the tally with the flag (ADR-039 addendum: the story moved on)", async () => {
    const lead = await makeLead();
    await setNoAnswer("bsystems", lead.id, true, admin);
    await setNoAnswer("bsystems", lead.id, true, admin);
    expect((await marker(lead.id)).count).toBe(2);

    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "following_up" },
      group: followUp,
      actor: admin,
      role: "bsystems_admin",
    });
    expect(await marker(lead.id)).toEqual({ noAnswer: false, count: 0, stage: "following_up" });
    expect(
      await db.activityLog.count({ where: { entityId: lead.id, trigger: "no_answer_cleared" } }),
    ).toBe(1);
  });

  it("moving an UNFLAGGED lead touches neither the flag nor the tally", async () => {
    const lead = await makeLead();
    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "following_up" },
      group: followUp,
      actor: admin,
      role: "bsystems_admin",
    });
    expect(await marker(lead.id)).toEqual({ noAnswer: false, count: 0, stage: "following_up" });
    expect(
      await db.activityLog.count({ where: { entityId: lead.id, trigger: "no_answer_cleared" } }),
    ).toBe(0);
  });
});

describe("Undo restores the PREVIOUS tally exactly, never just the boolean (ADR-064)", () => {
  it("undoing the 4th attempt leaves 3 — not zero, not the flag alone", async () => {
    const actor = await makeUser();
    const lead = await makeLead(actor);
    for (let i = 0; i < 4; i += 1) await setNoAnswer("bsystems", lead.id, true, actor);
    expect((await marker(lead.id)).count).toBe(4);

    expect(await pendingUndoFor(actor.id!)).not.toBeNull();
    await performUndo(actor);
    expect(await marker(lead.id)).toEqual({ noAnswer: true, count: 3, stage: lead.stage });
  });

  it("undoing the FIRST attempt puts the card back to no marker at all", async () => {
    const actor = await makeUser();
    const lead = await makeLead(actor);
    await setNoAnswer("bsystems", lead.id, true, actor);
    await performUndo(actor);
    expect(await marker(lead.id)).toEqual({ noAnswer: false, count: 0, stage: lead.stage });
  });

  it("undoing an Answered press gives the founder back the number they had", async () => {
    const actor = await makeUser();
    const lead = await makeLead(actor);
    for (let i = 0; i < 3; i += 1) await setNoAnswer("bsystems", lead.id, true, actor);
    await setNoAnswer("bsystems", lead.id, false, actor);
    expect((await marker(lead.id)).count).toBe(0);

    await performUndo(actor);
    expect(await marker(lead.id)).toEqual({ noAnswer: true, count: 3, stage: lead.stage });
  });

  it("undoing a stage MOVE restores the tally the move wiped, with the stage", async () => {
    const actor = await makeUser();
    const lead = await makeLead(actor);
    for (let i = 0; i < 2; i += 1) await setNoAnswer("bsystems", lead.id, true, actor);

    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "following_up" },
      group: followUp,
      actor,
      role: "bsystems_admin",
    });
    expect(await marker(lead.id)).toEqual({ noAnswer: false, count: 0, stage: "following_up" });

    await performUndo(actor);
    expect(await marker(lead.id)).toEqual({ noAnswer: true, count: 2, stage: lead.stage });
  });

  it("racing presses each snapshot their OWN prior number, never a stale one", async () => {
    /* Review — the undo payload used to be copied from the pre-transaction
       read, so the loser of a race snapshotted a number that was already gone
       while its FINGERPRINT still matched the row it wrote: the undo was
       accepted and rolled the tally further back than the press being undone.
       Asserted as a SET because the landing order of concurrent presses is not
       deterministic — what must hold is that the four presses between them
       recorded 0, 1, 2 and 3, each press naming the number it truly replaced. */
    const actor = await makeUser("Race Undo");
    const lead = await makeLead(actor);
    const PRESSES = 4;
    await Promise.all(
      Array.from({ length: PRESSES }, () => setNoAnswer("bsystems", lead.id, true, actor)),
    );
    expect((await marker(lead.id)).count).toBe(PRESSES);

    const entries = await db.undoEntry.findMany({
      where: { userId: actor.id!, kind: "lead_no_answer" },
      select: { payload: true },
    });
    const priors = entries
      .map((e) => (e.payload as { noAnswerCount: number }).noAnswerCount)
      .sort((a, b) => a - b);
    expect(priors).toEqual([0, 1, 2, 3]);
    /* and the flag rides the number, so undoing the first press clears it */
    for (const e of entries) {
      const p = e.payload as { noAnswer: boolean; noAnswerCount: number };
      expect(p.noAnswer).toBe(p.noAnswerCount > 0);
    }
  });

  it("an undo entry written BEFORE ADR-064 (boolean only) still revives sanely", async () => {
    const actor = await makeUser();
    const lead = await makeLead(actor);
    await setNoAnswer("bsystems", lead.id, true, actor);
    await setNoAnswer("bsystems", lead.id, true, actor);
    /* rewrite the pending entry as the OLD shape — the deploy window where a
       user's entry predates the migration */
    const entry = await db.undoEntry.findFirstOrThrow({
      where: { userId: actor.id!, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    await db.undoEntry.update({ where: { id: entry.id }, data: { payload: { noAnswer: true } } });

    await performUndo(actor);
    /* flagged with no number recorded means "it happened at least once" — the
       honest minimum, and the invariant still holds */
    expect(await marker(lead.id)).toEqual({ noAnswer: true, count: 1, stage: lead.stage });
  });
});

describe("Everything that keys on the FLAG keeps working (ADR-064 keeps the column)", () => {
  it("a where-clause on noAnswer finds a multi-attempt lead, and stops finding it when cleared", async () => {
    const lead = await makeLead();
    await setNoAnswer("bsystems", lead.id, true, admin);
    await setNoAnswer("bsystems", lead.id, true, admin);

    const flagged = await db.lead.findMany({ where: { noAnswer: true }, select: { id: true } });
    expect(flagged.map((l) => l.id)).toEqual([lead.id]);

    await setNoAnswer("bsystems", lead.id, false, admin);
    expect(await db.lead.count({ where: { noAnswer: true } })).toBe(0);
  });

  it("the board's own list carries both the flag and the tally, in step", async () => {
    const lead = await makeLead();
    await setNoAnswer("bsystems", lead.id, true, admin);
    await setNoAnswer("bsystems", lead.id, true, admin);
    await setNoAnswer("bsystems", lead.id, true, admin);

    const rows = await listBsLeads("any");
    const row = rows.find((l) => l.id === lead.id)!;
    expect(row.noAnswer).toBe(true);
    expect(row.noAnswerCount).toBe(3);
  });
});

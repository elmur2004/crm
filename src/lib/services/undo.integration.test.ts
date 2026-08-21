import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import {
  applyLeadEvent,
  createLead,
  deleteLead,
  markReadyToClose,
  setArchived,
  setNoAnswer,
  updateLead,
} from "./leads";
import { applyProspectEvent, createProspect } from "./partners";
import { checkMilestone } from "./milestones";
import { pendingUndoFor, performUndo, UNDO_WINDOW_MS } from "./undo";
import type { Actor } from "./activity";

/* ADR-045 — undo is a snapshot-inverse behind an allowlist and five guards.
   Every allowlisted kind restores its prior state, consumes its entry, and
   refuses a second application; ownership, expiry, changed-since and the
   financial line are each pinned here. */

let seq = 0;
async function makeUser(name = "Undo Tester") {
  const user = await db.user.create({
    data: { name, phone: `+2010999000${seq++}`, passwordHash: "x" },
  });
  return { id: user.id, label: user.name } satisfies Actor;
}

async function makeLead(actor: Actor, name = "Undo Corp") {
  return createLead(
    "bsystems",
    { name, number: "0101234567", type: "cold_call", companyName: "Undo Co" },
    actor,
  );
}

const followUp = {
  group: "follow_up" as const,
  data: { date: "2026-09-01", time: "10:00", method: "call" as const },
};

const WON_TAB = {
  estimatedValue: 100_000_00,
  totalCommissionPercentBp: 10_00,
  contractDate: "2026-08-01",
  milestones: [
    { label: "One", value: 100_000_00, commissionValue: 10_000_00, expectedEnd: "2026-09-01" },
  ],
};

beforeEach(async () => {
  await resetDb();
});

describe("Undo — the allowlisted kinds restore the prior state", () => {
  it("lead stage event: stage comes back, the group record it created is gone, the entry is spent", async () => {
    const actor = await makeUser();
    const lead = await makeLead(actor);
    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "following_up" },
      group: followUp,
      actor,
      role: "bsystems_admin",
    });
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).stage).toBe(
      "following_up",
    );
    expect(await db.followUp.count({ where: { leadId: lead.id } })).toBe(1);

    const pending = await pendingUndoFor(actor.id!);
    expect(pending?.label).toBe("Moved Undo Corp to Following Up");
    expect(pending?.labelAr).toContain("نقل");

    const done = await performUndo(actor);
    expect(done.label).toBe("Moved Undo Corp to Following Up");
    const after = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(after.stage).toBe("new");
    expect(await db.followUp.count({ where: { leadId: lead.id } })).toBe(0);
    /* the move is reverted AND recorded as an undo (never a silent rewrite) */
    expect(
      await db.activityLog.count({ where: { entityId: lead.id, trigger: "undo" } }),
    ).toBe(1);

    /* consumed: nothing is offered, and a second call refuses */
    expect(await pendingUndoFor(actor.id!)).toBeNull();
    await expect(performUndo(actor)).rejects.toThrow(/Nothing to undo/);
  });

  it("restores the no-answer flag, the ready-to-close flag, and the archive flag", async () => {
    const actor = await makeUser();
    const lead = await makeLead(actor);

    await setNoAnswer("bsystems", lead.id, true, actor);
    await performUndo(actor);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).noAnswer).toBe(false);

    await markReadyToClose("bsystems", lead.id, actor);
    expect((await pendingUndoFor(actor.id!))?.label).toBe("Marked Undo Corp ready to close");
    await performUndo(actor);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).readyToClose).toBe(false);

    await setArchived("bsystems", lead.id, true, actor);
    await performUndo(actor);
    const after = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(after.archived).toBe(false);
    expect(after.archivedAt).toBeNull();
  });

  it("lead edit: only the fields that were edited are put back", async () => {
    const actor = await makeUser();
    const lead = await makeLead(actor);
    await updateLead(
      "bsystems",
      lead.id,
      { name: "Renamed Corp", companyName: "Renamed Co" },
      actor,
    );
    await performUndo(actor);
    const after = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(after.name).toBe("Undo Corp");
    expect(after.companyName).toBe("Undo Co");
    expect(after.number).toBe("0101234567"); // untouched fields stay untouched
  });

  it("lead create: undo deletes the fresh lead — but not once it has history", async () => {
    const actor = await makeUser();
    const lead = await makeLead(actor, "Fresh Lead");
    expect((await pendingUndoFor(actor.id!))?.label).toBe("Added Fresh Lead");
    await performUndo(actor);
    expect(await db.lead.findUnique({ where: { id: lead.id } })).toBeNull();

    /* with a child record the create-undo refuses rather than destroy data */
    const second = await makeLead(actor, "Busy Lead");
    await db.leadComment.create({
      data: { leadId: second.id, authorLabel: "Someone", body: "hello" },
    });
    await expect(performUndo(actor)).rejects.toThrow(/no longer safe/);
    expect(await db.lead.findUnique({ where: { id: second.id } })).not.toBeNull();
  });

  it("prospect stage event: the partnership card goes back too", async () => {
    const actor = await makeUser();
    const prospect = await createProspect(
      {
        kind: "partner" as const,
        name: "Hany Mansour",
        companyName: "Mansour Trading",
        number: "0223456789",
        businessActivity: "Import/export",
      },
      actor,
    );
    /* ADR-059 — a follow-up is no longer a by-product of a stage move, so the
       two halves are undone separately. First the RECORD, written by the
       deliberate "record a follow-up" action while the card stays put. */
    await applyProspectEvent({
      prospectId: prospect.id,
      event: { type: "next_action", action: "follow_up_again" },
      group: followUp,
      actor,
      role: "bsystems_admin",
    });
    expect(await db.followUp.count({ where: { partnerProspectId: prospect.id } })).toBe(1);
    await performUndo(actor);
    expect(await db.followUp.count({ where: { partnerProspectId: prospect.id } })).toBe(0);
    expect(
      (await db.partnerProspect.findUniqueOrThrow({ where: { id: prospect.id } })).stage,
    ).toBe(prospect.stage); // it never moved in the first place

    /* ...and then a MOVE, which now carries no group at all (founder 1.1). */
    await applyProspectEvent({
      prospectId: prospect.id,
      event: { type: "next_action", action: "waiting" },
      actor,
      role: "bsystems_admin",
    });
    expect(
      (await db.partnerProspect.findUniqueOrThrow({ where: { id: prospect.id } })).stage,
    ).toBe("waiting");
    await performUndo(actor);
    const after = await db.partnerProspect.findUniqueOrThrow({ where: { id: prospect.id } });
    expect(after.stage).toBe(prospect.stage);
    expect(await db.followUp.count({ where: { partnerProspectId: prospect.id } })).toBe(0);
  });
});

describe("Undo — the guards", () => {
  it("is personal: another user can neither see nor apply it", async () => {
    const mine = await makeUser("Owner");
    const other = await makeUser("Someone Else");
    const lead = await makeLead(mine);
    await setNoAnswer("bsystems", lead.id, true, mine);

    expect(await pendingUndoFor(other.id!)).toBeNull();
    await expect(performUndo(other)).rejects.toThrow(/Nothing to undo/);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).noAnswer).toBe(true);
    /* the owner's entry is untouched by the failed attempt */
    expect(await pendingUndoFor(mine.id!)).not.toBeNull();
  });

  it("expires: past the window it is neither offered nor applied", async () => {
    const actor = await makeUser();
    const lead = await makeLead(actor);
    await setNoAnswer("bsystems", lead.id, true, actor);
    /* age out EVERY entry of this user: in real life they can only ever expire
       oldest-first, so backdating just the newest would fake an impossible state */
    const entry = await db.undoEntry.findFirstOrThrow({
      where: { userId: actor.id! },
      orderBy: { createdAt: "desc" },
    });
    await db.undoEntry.updateMany({
      where: { userId: actor.id! },
      data: { createdAt: new Date(Date.now() - UNDO_WINDOW_MS - 1000) },
    });

    expect(await pendingUndoFor(actor.id!)).toBeNull();
    await expect(performUndo(actor)).rejects.toThrow(/too old/);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).noAnswer).toBe(true);
    /* it is retired, so it can never resurface */
    expect(
      (await db.undoEntry.findUniqueOrThrow({ where: { id: entry.id } })).consumedAt,
    ).not.toBeNull();
  });

  it("refuses when the entity moved on since (fingerprint mismatch)", async () => {
    const actor = await makeUser();
    const other = await makeUser("Colleague");
    const lead = await makeLead(actor);
    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "following_up" },
      group: followUp,
      actor,
      role: "bsystems_admin",
    });
    /* a colleague moves the same lead on */
    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "meeting_setting" },
      group: {
        group: "meeting",
        data: { arranged: true, date: "2026-09-03", time: "14:00", mode: "online" as const },
      },
      actor: other,
      role: "bsystems_admin",
    });

    await expect(performUndo(actor)).rejects.toThrow(/no longer safe/);
    /* nothing was rolled back — the later move stands */
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).stage).toBe(
      "meeting_setting",
    );
  });

  it("a win is never undoable, and it silences the button instead of offering an older action", async () => {
    const actor = await makeUser();
    const lead = await makeLead(actor);
    await setNoAnswer("bsystems", lead.id, true, actor); // an undoable action first
    expect(await pendingUndoFor(actor.id!)).not.toBeNull();

    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "won" },
      group: { group: "won_deal", data: WON_TAB },
      actor,
      role: "bsystems_admin",
    });
    expect(await pendingUndoFor(actor.id!)).toBeNull();
    await expect(performUndo(actor)).rejects.toThrow(/Nothing to undo/);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).stage).toBe("won");
    expect(await db.wonDeal.count({ where: { leadId: lead.id } })).toBe(1);
  });

  it("money moves and deletions retire pending entries too", async () => {
    const actor = await makeUser();
    const lead = await makeLead(actor);

    /* a checked milestone (money) clears whatever was pending */
    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "won" },
      group: { group: "won_deal", data: WON_TAB },
      actor,
      role: "bsystems_admin",
    });
    const won = await db.wonDeal.findUniqueOrThrow({
      where: { leadId: lead.id },
      include: { milestones: true },
    });
    await setNoAnswer("bsystems", lead.id, true, actor).catch(() => undefined);
    await checkMilestone(won.milestones[0]!.id, actor);
    expect(await pendingUndoFor(actor.id!)).toBeNull();

    /* deletion is not undoable and leaves nothing behind to offer */
    const doomed = await makeLead(actor, "Doomed Lead");
    expect(await pendingUndoFor(actor.id!)).not.toBeNull();
    await deleteLead("bsystems", doomed.id, actor);
    expect(await pendingUndoFor(actor.id!)).toBeNull();
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { cairoToUtc } from "@/lib/datetime";
import { applyLeadEvent, createLead } from "./leads";
import { applyProspectEvent, createProspect } from "./partners";
import { todoFor } from "./todo";
import { pendingUndoFor, performUndo } from "./undo";
import type { Actor } from "./activity";

/* Founder (same-stage records):
     (a) "if I followed up with them and they need another follow-up, add a
         button inside the lead";
     (b) "when we put it in negotiations we need a follow-up for the
         negotiation itself — the date we will have a response for them";
     (c) "the meeting setting, the same thing — a button to reschedule".
   All three are ENGINE next actions that resolve to the stage the card is
   already in: a record is written, the card never moves, the activity log and
   the To-Do "latest record" projection follow along automatically. */

const NOW = cairoToUtc("2026-08-20", "12:00");

let seq = 0;
async function makeActor(): Promise<Actor> {
  const user = await db.user.create({
    data: { name: "Same Stage Tester", phone: `+2010777000${seq++}`, passwordHash: "x" },
  });
  return { id: user.id, label: user.name };
}

async function makeLead(actor: Actor, name = "Same Stage Corp") {
  return createLead(
    "bsystems",
    { name, number: "0101234567", type: "cold_call", companyName: "Same Stage Co" },
    actor,
  );
}

const followUp = (date: string, time = "10:00") => ({
  group: "follow_up" as const,
  data: { date, time, method: "call" as const },
});

const meeting = (date: string, time: string) => ({
  group: "meeting" as const,
  data: { arranged: true, date, time, mode: "online" as const },
});

async function move(
  leadId: string,
  action: string,
  group: unknown,
  actor: Actor,
  role: "bsystems_admin" | "bsystems_agent" = "bsystems_admin",
) {
  return applyLeadEvent({
    brand: "bsystems",
    leadId,
    event: { type: "next_action", action },
    group: group as never,
    actor,
    role,
  });
}

beforeEach(async () => {
  await resetDb();
});

describe("(a) another follow-up while still Following Up", () => {
  it("records a second follow-up, leaves the stage alone, logs it, and the To-Do shows the NEW date", async () => {
    const actor = await makeActor();
    const lead = await makeLead(actor);
    await move(lead.id, "following_up", followUp("2026-08-18"), actor); // overdue by NOW

    const before = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(before.overdue.map((i) => i.title)).toEqual(["Same Stage Corp"]);

    const result = await move(lead.id, "follow_up_again", followUp("2026-08-20", "16:00"), actor);

    /* the card never moved */
    expect(result.toStage).toBe("following_up");
    const fresh = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(fresh.stage).toBe("following_up");

    /* a SECOND record, not an edit of the first */
    const followUps = await db.followUp.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: "asc" },
    });
    expect(followUps).toHaveLength(2);
    expect(followUps[1]!.context).toBe("initial");

    /* activity logged as a record addition — no from → to arrow */
    const log = await db.activityLog.findFirst({
      where: { entityId: lead.id, trigger: "FU-AGAIN" },
    });
    expect(log).not.toBeNull();
    expect(log!.action).toBe("group_added");
    expect(log!.fromStage).toBeNull();
    expect(log!.toStage).toBeNull();

    /* the To-Do swaps to the NEW date; the superseded one stops being overdue */
    const after = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(after.overdue).toEqual([]);
    expect(after.today.map((i) => i.title)).toEqual(["Same Stage Corp"]);
    expect(after.today[0]!.at.getTime()).toBe(cairoToUtc("2026-08-20", "16:00").getTime());
  });

  it("works for an agent on their own lead, with the day-only light form (09:00 Cairo default)", async () => {
    const admin = await makeActor();
    const agentUser = await db.user.create({
      data: { name: "Light Agent", phone: "+201077799911", passwordHash: "x" },
    });
    const agent: Actor = { id: agentUser.id, label: agentUser.name };
    const lead = await createLead(
      "bsystems",
      { name: "Agent Lead", number: "0102223334", type: "cold_call", companyName: "Agent Co" },
      admin,
      { ownerType: "agent", ownerUserId: agentUser.id },
    );
    await move(lead.id, "following_up", followUp("2026-08-19"), agent, "bsystems_agent");

    /* V2 §3: the agent form sends NO time */
    await move(
      lead.id,
      "follow_up_again",
      { group: "follow_up", data: { date: "2026-08-20", method: "message" } },
      agent,
      "bsystems_agent",
    );

    const rows = await db.followUp.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: "asc" },
    });
    expect(rows).toHaveLength(2);
    expect(rows[1]!.dueAt.getTime()).toBe(cairoToUtc("2026-08-20", "09:00").getTime());
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).stage).toBe("following_up");
  });

  it("undo describes the record (not a move) and removes exactly it", async () => {
    const actor = await makeActor();
    const lead = await makeLead(actor);
    await move(lead.id, "following_up", followUp("2026-08-18"), actor);
    await move(lead.id, "follow_up_again", followUp("2026-08-25"), actor);

    expect((await pendingUndoFor(actor.id!))?.label).toBe(
      "Recorded another follow-up on Same Stage Corp",
    );
    await performUndo(actor);

    const rows = await db.followUp.findMany({ where: { leadId: lead.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.dueAt.getTime()).toBe(cairoToUtc("2026-08-18", "10:00").getTime());
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).stage).toBe("following_up");
  });

  it("is offered on the partnership pipeline too", async () => {
    const actor = await makeActor();
    const prospect = await createProspect(
      {
        name: "Hany Mansour",
        companyName: "Mansour Trading",
        number: "0223456789",
        businessActivity: "Import/export",
      },
      actor,
    );
    await applyProspectEvent({
      prospectId: prospect.id,
      event: { type: "next_action", action: "following_up" },
      group: followUp("2026-08-18") as never,
      actor,
      role: "bsystems_admin",
    });
    await applyProspectEvent({
      prospectId: prospect.id,
      event: { type: "next_action", action: "follow_up_again" },
      group: followUp("2026-08-20", "11:00") as never,
      actor,
      role: "bsystems_admin",
    });

    expect(
      (await db.partnerProspect.findUniqueOrThrow({ where: { id: prospect.id } })).stage,
    ).toBe("following_up");
    expect(await db.followUp.count({ where: { partnerProspectId: prospect.id } })).toBe(2);
    const lists = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(lists.today.map((i) => i.kind)).toEqual(["prospect_follow_up"]);
  });
});

describe("(b) the negotiation's own follow-up — the promised response date", () => {
  it("records an after_negotiation follow-up, stays in Negotiation, and reaches the To-Do", async () => {
    const actor = await makeActor();
    const lead = await makeLead(actor, "Negotiating Corp");
    await move(lead.id, "following_up", followUp("2026-08-15"), actor);
    await move(lead.id, "negotiation", { group: "negotiation", data: { note: "Price talks" } }, actor);

    /* the stale follow-up from Following Up must not resurface in Negotiation */
    const before = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(before.overdue).toEqual([]);
    expect(before.today).toEqual([]);

    const result = await move(
      lead.id,
      "negotiation_follow_up",
      followUp("2026-08-20", "14:00"),
      actor,
    );
    expect(result.toStage).toBe("negotiation");
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).stage).toBe("negotiation");

    const rows = await db.followUp.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: "asc" },
    });
    expect(rows).toHaveLength(2);
    expect(rows[1]!.context).toBe("after_negotiation");

    const log = await db.activityLog.findFirst({
      where: { entityId: lead.id, trigger: "NEG-DUE" },
    });
    expect(log?.action).toBe("group_added");

    const after = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(after.today.map((i) => i.title)).toEqual(["Negotiating Corp"]);
    expect(after.today[0]!.at.getTime()).toBe(cairoToUtc("2026-08-20", "14:00").getTime());
    expect((await pendingUndoFor(actor.id!))?.label).toBe(
      "Recorded the response date on Negotiating Corp",
    );
  });

  it("is a B-Systems-only stage: the internal ByteForce pipeline never offers it", async () => {
    const actor = await makeActor();
    const lead = await createLead(
      "byteforce",
      { name: "BF Lead", number: "0104445556", type: "cold_call" },
      actor,
    );
    await applyLeadEvent({
      brand: "byteforce",
      leadId: lead.id,
      event: { type: "next_action", action: "following_up" },
      group: followUp("2026-08-20") as never,
      actor,
      role: "byteforce_staff",
    });
    await expect(
      applyLeadEvent({
        brand: "byteforce",
        leadId: lead.id,
        event: { type: "next_action", action: "negotiation_follow_up" },
        group: followUp("2026-08-21") as never,
        actor,
        role: "byteforce_staff",
      }),
    ).rejects.toThrow(/not available/);
  });
});

describe("(c) rescheduling the meeting without leaving Meeting Setting", () => {
  it("records a NEW meeting; the To-Do shows the new slot and the old one does not linger in Overdue", async () => {
    const actor = await makeActor();
    const lead = await makeLead(actor, "Meeting Corp");
    await move(lead.id, "meeting_setting", meeting("2026-08-18", "09:00"), actor); // overdue by NOW

    const before = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(before.overdue.map((i) => i.kind)).toEqual(["meeting"]);

    const result = await move(lead.id, "reschedule_meeting", meeting("2026-08-20", "17:00"), actor);
    expect(result.toStage).toBe("meeting_setting");
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).stage).toBe(
      "meeting_setting",
    );

    const meetings = await db.meeting.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: "asc" },
    });
    expect(meetings).toHaveLength(2);
    expect(meetings[0]!.datetime!.getTime()).toBe(cairoToUtc("2026-08-18", "09:00").getTime());
    expect(meetings[1]!.datetime!.getTime()).toBe(cairoToUtc("2026-08-20", "17:00").getTime());

    const log = await db.activityLog.findFirst({
      where: { entityId: lead.id, trigger: "MTG-RESCHEDULE" },
    });
    expect(log?.action).toBe("group_added");

    /* the superseded meeting leaves Overdue entirely — the founder's point */
    const after = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(after.overdue).toEqual([]);
    expect(after.today.map((i) => i.kind)).toEqual(["meeting"]);
    expect(after.today[0]!.at.getTime()).toBe(cairoToUtc("2026-08-20", "17:00").getTime());

    expect((await pendingUndoFor(actor.id!))?.label).toBe(
      "Rescheduled the meeting on Meeting Corp",
    );
    await performUndo(actor);
    expect(await db.meeting.count({ where: { leadId: lead.id } })).toBe(1);
  });
});

describe("same-stage actions are stage-scoped", () => {
  it("a follow-up-again is refused from a stage that does not own the record", async () => {
    const actor = await makeActor();
    const lead = await makeLead(actor);
    await expect(
      move(lead.id, "follow_up_again", followUp("2026-08-20"), actor), // still "new"
    ).rejects.toThrow(/not available/);
    await expect(
      move(lead.id, "reschedule_meeting", meeting("2026-08-20", "10:00"), actor),
    ).rejects.toThrow(/not available/);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { cairoToUtc } from "@/lib/datetime";
import { applyLeadEvent, createLead } from "./leads";
import { applyProspectEvent, createProspect } from "./partners";
import { todoFor } from "./todo";
import { setTodoDone } from "./todo-done";
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

    /* ADR-061: an overdue follow-up is INVISIBLE on the To-Do (only the board
       card still shows its date) — so before the new record, nothing lists */
    const before = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(before.today).toEqual([]);

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

    /* the To-Do picks up the NEW date — today, so the row appears */
    const after = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
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

  it("is offered from every active stage of the prospect pipeline (ADR-059)", async () => {
    const actor = await makeActor();
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
    /* ADR-059 — this action is now the ONLY way a prospect follow-up is ever
       created, and it is offered from every active stage. Contacted itself
       writes nothing (founder item 2.1), so the card is moved there first with
       no group at all and BOTH follow-ups come from the button. */
    await applyProspectEvent({
      prospectId: prospect.id,
      event: { type: "next_action", action: "contacted" },
      actor,
      role: "bsystems_admin",
    });
    expect(await db.followUp.count({ where: { partnerProspectId: prospect.id } })).toBe(0);
    await applyProspectEvent({
      prospectId: prospect.id,
      event: { type: "next_action", action: "follow_up_again" },
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
    ).toBe("contacted");
    expect(await db.followUp.count({ where: { partnerProspectId: prospect.id } })).toBe(2);
    /* ADR-061: the record is real (two rows above) but partner tasks no
       longer reach the To-Do at all */
    const lists = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(lists.today).toEqual([]);
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
    /* Founder (ADR-068) — "check their response": the row arrives under its OWN
       kind, so the To-Do says at a glance that this one is an answer he is
       waiting for rather than another call he owes. */
    expect(after.today[0]!.kind).toBe("negotiation_response");
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
  it("records a NEW meeting; the To-Do shows the new slot (the overdue one is invisible, ADR-061)", async () => {
    const actor = await makeActor();
    const lead = await makeLead(actor, "Meeting Corp");
    await move(lead.id, "meeting_setting", meeting("2026-08-18", "09:00"), actor); // overdue by NOW

    /* ADR-061: an overdue meeting no longer lists — today is the only list */
    const before = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(before.today).toEqual([]);

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

    /* the new slot is today's — the row appears, and only once */
    const after = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
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

/* ============================================================================
   ADR-068 — the negotiation response date has its OWN To-Do row.

   Founder: "make sure that the response date is made in the to do list as see
   their response or check their response or check with them in the
   negotiations." The split is a LABEL over the same FollowUp record — so most
   of what follows is about what did NOT change: the same id, the same mark,
   the same walls, the same Done section.
   ========================================================================== */
describe("(b2) the negotiation response row is its own kind, and nothing else moved", () => {
  async function leadAwaitingResponse(actor: Actor, name = "Awaiting Reply Co") {
    const lead = await makeLead(actor, name);
    await move(lead.id, "following_up", followUp("2026-08-15"), actor);
    await move(lead.id, "negotiation", { group: "negotiation", data: { note: "Terms" } }, actor);
    await move(lead.id, "negotiation_follow_up", followUp("2026-08-20", "14:00"), actor);
    return lead;
  }

  it("an ordinary Following Up row stays a plain follow-up — the two are told apart", async () => {
    const actor = await makeActor();
    const plain = await makeLead(actor, "Plain Follow Co");
    await move(plain.id, "following_up", followUp("2026-08-20", "11:00"), actor);
    await leadAwaitingResponse(actor);

    const lists = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(Object.fromEntries(lists.today.map((i) => [i.title, i.kind]))).toEqual({
      "Plain Follow Co": "follow_up",
      "Awaiting Reply Co": "negotiation_response",
    });
  });

  it("the discriminator is the RECORD's context, not the lead's current stage", async () => {
    /* The deal is answered and moves to Lost the same afternoon. The Done row
       must keep its own wording: it records what today's task WAS, and renaming
       it "Follow-up" after the fact would rewrite that. */
    const actor = await makeActor();
    const lead = await leadAwaitingResponse(actor, "Answered Today Co");
    await move(lead.id, "lost", { group: "lost", data: { reason: "Chose a rival" } }, actor);

    const lists = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(lists.today).toEqual([]);
    expect(lists.done.map((i) => [i.title, i.kind])).toEqual([
      ["Answered Today Co", "negotiation_response"],
    ]);
    expect(lists.done[0]!.done).toEqual({ by: "auto", reason: "moved", stage: "lost" });
  });

  it("the checkbox still works, marks the SAME row, and restores — ADR-062 behaviour intact", async () => {
    const actor = await makeActor();
    await leadAwaitingResponse(actor, "Tickable Reply Co");
    const before = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    const row = before.today[0]!;
    expect(row.kind).toBe("negotiation_response");

    await setTodoDone({
      brand: "bsystems",
      kind: "negotiation_response",
      recordId: row.recordId,
      done: true,
      actor,
      now: NOW,
    });
    const marks = await db.todoDone.findMany();
    expect(marks).toHaveLength(1);
    expect(marks[0]!.followUpId).toBe(row.recordId);

    const after = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(after.today).toEqual([]);
    expect(after.done.map((i) => [i.kind, i.done])).toEqual([
      ["negotiation_response", { by: "manual", name: actor.label }],
    ]);

    /* unchecking restores it to Today, still under its own name */
    await setTodoDone({
      brand: "bsystems",
      kind: "negotiation_response",
      recordId: row.recordId,
      done: false,
      actor,
      now: NOW,
    });
    const restored = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(restored.today.map((i) => i.kind)).toEqual(["negotiation_response"]);
    expect(restored.done).toEqual([]);
  });

  it("an older client still posting the plain kind ticks the SAME row — the split is a label", async () => {
    const actor = await makeActor();
    await leadAwaitingResponse(actor, "Old Client Co");
    const row = (await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW })).today[0]!;

    await setTodoDone({
      brand: "bsystems",
      kind: "follow_up",
      recordId: row.recordId,
      done: true,
      actor,
      now: NOW,
    });
    /* ONE mark, on the follow-up id — never a second piece of state */
    expect(await db.todoDone.count()).toBe(1);
    const lists = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(lists.today).toEqual([]);
    expect(lists.done.map((i) => i.kind)).toEqual(["negotiation_response"]);
  });

  it("keeps the today-only window: a response due tomorrow is not on today's list", async () => {
    const actor = await makeActor();
    const lead = await makeLead(actor, "Tomorrow Reply Co");
    await move(lead.id, "following_up", followUp("2026-08-15"), actor);
    await move(lead.id, "negotiation", { group: "negotiation", data: { note: "Terms" } }, actor);
    await move(lead.id, "negotiation_follow_up", followUp("2026-08-21", "10:00"), actor);

    const lists = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(lists.today).toEqual([]);
    expect(lists.done).toEqual([]);
  });

  it("keeps the scope wall: a sales rep never sees an agent-owned response row", async () => {
    const actor = await makeActor();
    const owner = await db.user.create({
      data: { name: "Agent Owner", phone: `+2010777900${seq++}`, passwordHash: "x" },
    });
    const lead = await leadAwaitingResponse(actor, "Agent Owned Reply Co");
    await db.lead.update({
      where: { id: lead.id },
      data: { ownerType: "agent", ownerUserId: owner.id },
    });

    const asSales = await todoFor({ brand: "bsystems", scope: { kind: "internal" }, now: NOW });
    expect(asSales.today).toEqual([]);
    const asOwner = await todoFor({
      brand: "bsystems",
      scope: { kind: "own", userId: owner.id },
      now: NOW,
    });
    expect(asOwner.today.map((i) => i.kind)).toEqual(["negotiation_response"]);
  });
});

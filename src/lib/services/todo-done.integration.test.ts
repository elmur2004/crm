import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { cairoToUtc } from "@/lib/datetime";
import type { Actor } from "./activity";
import { leadIdOfTodoRecord, setTodoDone } from "./todo-done";
import { deleteLead } from "./leads";

/* ADR-062 — manual To-Do completion. The mark is keyed to the UNDERLYING
   record id (the founder's whole point: a NEW follow-up on the same lead is a
   NEW task and arrives unchecked), snapshots the due instant, and the service
   refuses to mark anything that is not a live task in today's Cairo window —
   so TodoDone rows stay meaningful. Fixed instants throughout. */

const NOW = cairoToUtc("2026-08-20", "12:00");
const actor: Actor = { id: null, label: "Elmur" };

function makeLead(opts: { name: string; stage: string; brand?: string; archived?: boolean }) {
  return db.lead.create({
    data: {
      brand: opts.brand ?? "bsystems",
      name: opts.name,
      number: "0100000000",
      type: "cold_call",
      stage: opts.stage,
      archived: opts.archived ?? false,
    },
  });
}

function fu(leadId: string, dueAt: Date, createdAt?: Date) {
  return db.followUp.create({
    data: { leadId, context: "initial", dueAt, method: "call", ...(createdAt ? { createdAt } : {}) },
  });
}

type Kind = "follow_up" | "meeting" | "statement" | "milestone";
type Brand = "byteforce" | "bsystems";
const check = (kind: Kind, recordId: string, brand: Brand = "bsystems") =>
  setTodoDone({ brand, kind, recordId, done: true, actor, now: NOW });
const uncheck = (kind: Kind, recordId: string, brand: Brand = "bsystems") =>
  setTodoDone({ brand, kind, recordId, done: false, actor, now: NOW });

beforeEach(async () => {
  await resetDb();
});

describe("setTodoDone — check / uncheck round-trip", () => {
  it("checking a live follow-up writes ONE mark (FK + dueAt snapshot + completer label); unchecking deletes it; both are idempotent", async () => {
    const user = await db.user.create({
      data: { name: "Karim Adel", phone: "+201001234567", passwordHash: "x" },
    });
    const lead = await makeLead({ name: "Checkable", stage: "following_up" });
    const dueAt = cairoToUtc("2026-08-20", "09:00");
    const f = await fu(lead.id, dueAt);

    await setTodoDone({
      brand: "bsystems",
      kind: "follow_up",
      recordId: f.id,
      done: true,
      actor: { id: user.id, label: user.name },
      now: NOW,
    });
    const mark = await db.todoDone.findUniqueOrThrow({ where: { followUpId: f.id } });
    expect(mark.dueAt.getTime()).toBe(dueAt.getTime());
    expect(mark.completedById).toBe(user.id);
    expect(mark.completedByLabel).toBe("Karim Adel");
    expect(mark.completedAt.getTime()).toBe(NOW.getTime());

    /* double-check never errors and never duplicates (unique FK upsert) */
    await check("follow_up", f.id);
    expect(await db.todoDone.count()).toBe(1);

    await uncheck("follow_up", f.id);
    expect(await db.todoDone.count()).toBe(0);
    await uncheck("follow_up", f.id); // idempotent no-op
    expect(await db.todoDone.count()).toBe(0);
  });

  it("IDENTITY — a new follow-up on the same lead is a NEW task: the old id refuses the mark, the new id arrives unchecked and checks fine", async () => {
    const lead = await makeLead({ name: "Identity", stage: "following_up" });
    const oldF = await fu(lead.id, cairoToUtc("2026-08-20", "09:00"), new Date("2026-08-18T00:00:00Z"));
    const newF = await fu(lead.id, cairoToUtc("2026-08-20", "15:00"), new Date("2026-08-19T00:00:00Z"));

    /* the superseded record is no longer today's task — refuse the mark */
    await expect(check("follow_up", oldF.id)).rejects.toThrow(/not on today/);
    /* the new record has no mark (new id — nothing to inherit) and checks */
    expect(await db.todoDone.findUnique({ where: { followUpId: newF.id } })).toBeNull();
    await check("follow_up", newF.id);
    expect(await db.todoDone.count()).toBe(1);
  });

  it("re-checking refreshes the dueAt snapshot — the recovery path after a meeting reschedule to later TODAY", async () => {
    const lead = await makeLead({ name: "Resched", stage: "meeting_setting" });
    const m = await db.meeting.create({
      data: { leadId: lead.id, arranged: true, datetime: cairoToUtc("2026-08-20", "10:00") },
    });
    await check("meeting", m.id);
    const before = await db.todoDone.findUniqueOrThrow({ where: { meetingId: m.id } });
    expect(before.dueAt.getTime()).toBe(cairoToUtc("2026-08-20", "10:00").getTime());

    /* the ONE record edited in place (leads.ts meeting_reschedule): same id,
       new datetime — the stale snapshot stops matching (the projection resets
       it to unchecked); checking again snapshots the NEW instant */
    await db.meeting.update({
      where: { id: m.id },
      data: { datetime: cairoToUtc("2026-08-20", "17:00") },
    });
    await check("meeting", m.id);
    const after = await db.todoDone.findUniqueOrThrow({ where: { meetingId: m.id } });
    expect(after.dueAt.getTime()).toBe(cairoToUtc("2026-08-20", "17:00").getTime());
    expect(await db.todoDone.count()).toBe(1); // still ONE mark per record
  });
});

describe("setTodoDone — liveness walls (a mark on a non-task is refused)", () => {
  it("refuses a follow-up whose lead moved stage, an archived lead, and one not due today", async () => {
    const moved = await makeLead({ name: "Moved", stage: "meeting_setting" });
    const fMoved = await fu(moved.id, cairoToUtc("2026-08-20", "09:00"));
    await expect(check("follow_up", fMoved.id)).rejects.toThrow(/not on today/);

    const archived = await makeLead({ name: "Archived", stage: "following_up", archived: true });
    const fArch = await fu(archived.id, cairoToUtc("2026-08-20", "09:00"));
    await expect(check("follow_up", fArch.id)).rejects.toThrow(/not on today/);

    const future = await makeLead({ name: "Future", stage: "following_up" });
    const fFut = await fu(future.id, cairoToUtc("2026-08-25", "09:00"));
    await expect(check("follow_up", fFut.id)).rejects.toThrow(/not on today/);

    /* ADR-061: an OVERDUE follow-up is off the To-Do — not checkable either */
    const overdue = await makeLead({ name: "Overdue", stage: "following_up" });
    const fOver = await fu(overdue.id, cairoToUtc("2026-08-19", "09:00"));
    await expect(check("follow_up", fOver.id)).rejects.toThrow(/not on today/);
    expect(await db.todoDone.count()).toBe(0);
  });

  it("refuses a meeting that is unarranged, resolved, or superseded by a newer record", async () => {
    const lead = await makeLead({ name: "Meetings", stage: "meeting_setting" });
    const unarranged = await db.meeting.create({
      data: { leadId: lead.id, arranged: false, datetime: cairoToUtc("2026-08-20", "10:00") },
    });
    await expect(check("meeting", unarranged.id)).rejects.toThrow(/not on today/);

    const resolved = await makeLead({ name: "Resolved", stage: "meeting_setting" });
    const withOutcome = await db.meeting.create({
      data: {
        leadId: resolved.id,
        arranged: true,
        datetime: cairoToUtc("2026-08-20", "11:00"),
        outcome: "attended",
      },
    });
    await expect(check("meeting", withOutcome.id)).rejects.toThrow(/not on today/);

    const raced = await makeLead({ name: "Raced", stage: "meeting_setting" });
    const stale = await db.meeting.create({
      data: {
        leadId: raced.id,
        arranged: true,
        datetime: cairoToUtc("2026-08-20", "12:00"),
        createdAt: new Date("2026-08-14T00:00:00Z"),
      },
    });
    await db.meeting.create({
      data: {
        leadId: raced.id,
        arranged: false,
        datetime: cairoToUtc("2026-08-22", "12:00"),
        createdAt: new Date("2026-08-16T00:00:00Z"), // newest — a proposed slot
      },
    });
    await expect(check("meeting", stale.id)).rejects.toThrow(/not on today/);
  });

  it("BRAND comes from the route: a B-Systems record 404s under the byteforce brand and vice versa", async () => {
    const bs = await makeLead({ name: "BS Lead", stage: "following_up" });
    const fBs = await fu(bs.id, cairoToUtc("2026-08-20", "09:00"));
    await expect(check("follow_up", fBs.id, "byteforce")).rejects.toThrow(/not found/);

    const bf = await makeLead({ name: "BF Lead", stage: "following_up", brand: "byteforce" });
    const fBf = await fu(bf.id, cairoToUtc("2026-08-20", "09:00"));
    await expect(check("follow_up", fBf.id)).rejects.toThrow(/not found/);
    await setTodoDone({
      brand: "byteforce",
      kind: "follow_up",
      recordId: fBf.id,
      done: true,
      actor,
      now: NOW,
    });
    expect(await db.todoDone.count()).toBe(1);
  });

  it("ADR-061 — a prospect-parented record has no lead to guard: leadIdOfTodoRecord 404s it outright", async () => {
    const prospect = await db.partnerProspect.create({
      data: {
        name: "Prospect Person",
        companyName: "Prospect Co",
        number: "0100000001",
        businessActivity: "Consulting",
        stage: "contacted",
      },
    });
    const pf = await db.followUp.create({
      data: {
        partnerProspectId: prospect.id,
        context: "initial",
        dueAt: cairoToUtc("2026-08-20", "10:00"),
        method: "call",
      },
    });
    await expect(leadIdOfTodoRecord("follow_up", pf.id)).rejects.toThrow(/not found/);
    await expect(leadIdOfTodoRecord("follow_up", "nonexistent")).rejects.toThrow(/not found/);

    /* the good path returns the lead for the route's requireLeadAccess */
    const lead = await makeLead({ name: "Guarded", stage: "following_up" });
    const f = await fu(lead.id, cairoToUtc("2026-08-20", "09:00"));
    expect(await leadIdOfTodoRecord("follow_up", f.id)).toBe(lead.id);
  });
});

describe("setTodoDone — the money kinds (admin-only rows, due-before-END-of-today)", () => {
  async function wonScaffold() {
    const wl = await makeLead({ name: "Money Lead", stage: "won" });
    const deal = await db.wonDeal.create({
      data: { leadId: wl.id, estimatedValue: 1000, totalCommissionPercent: 1000 },
    });
    return { wl, deal };
  }

  it("a pending statement expected YESTERDAY is still today's task (money never vanishes) — a paid one is auto-done, not checkable", async () => {
    const { deal } = await wonScaffold();
    const ms = await db.milestone.create({ data: { wonDealId: deal.id, index: 1, value: 500 } });
    const s = await db.statement.create({
      data: {
        code: "ST-9001",
        milestoneId: ms.id,
        clientName: "Money Lead",
        milestoneLabel: "M1",
        milestoneValue: 0,
        percentBp: 0,
        amount: 0,
        closerLabel: "x",
        status: "pending",
        expectedDate: cairoToUtc("2026-08-19", "00:00"), // yesterday — < end, still listed
      },
    });
    await check("statement", s.id);
    const mark = await db.todoDone.findUniqueOrThrow({ where: { statementId: s.id } });
    expect(mark.dueAt.getTime()).toBe(cairoToUtc("2026-08-19", "00:00").getTime());

    await db.statement.update({ where: { id: s.id }, data: { status: "paid", paidAt: NOW } });
    await expect(check("statement", s.id)).rejects.toThrow(/not on today/);
  });

  it("a milestone: open + expected before end-of-today is checkable; completed or undated is not; the money kinds refuse the byteforce brand", async () => {
    const { deal } = await wonScaffold();
    const open = await db.milestone.create({
      data: { wonDealId: deal.id, index: 1, value: 500, expectedEnd: cairoToUtc("2026-08-20", "00:00") },
    });
    const completed = await db.milestone.create({
      data: {
        wonDealId: deal.id,
        index: 2,
        value: 500,
        expectedEnd: cairoToUtc("2026-08-20", "00:00"),
        completed: true,
        completedAt: NOW,
      },
    });
    const undated = await db.milestone.create({ data: { wonDealId: deal.id, index: 3, value: 500 } });

    await check("milestone", open.id);
    expect(await db.todoDone.findUnique({ where: { milestoneId: open.id } })).toBeTruthy();
    await expect(check("milestone", completed.id)).rejects.toThrow(/not on today/);
    await expect(check("milestone", undated.id)).rejects.toThrow(/not on today/);
    await expect(check("milestone", open.id, "byteforce")).rejects.toThrow(/not found/);
  });
});

describe("cascades — a deleted record silently retires its mark", () => {
  it("deleteLead removes the marks with the lead's records (follow-up cascade AND the hand-deleted statement path)", async () => {
    const lead = await makeLead({ name: "Doomed", stage: "following_up" });
    const f = await fu(lead.id, cairoToUtc("2026-08-20", "09:00"));
    await check("follow_up", f.id);

    const { deal } = await (async () => {
      const wl = await makeLead({ name: "Doomed Money", stage: "won" });
      const deal = await db.wonDeal.create({
        data: { leadId: wl.id, estimatedValue: 1000, totalCommissionPercent: 1000 },
      });
      return { wl, deal };
    })();
    const ms = await db.milestone.create({
      data: { wonDealId: deal.id, index: 1, value: 500, expectedEnd: cairoToUtc("2026-08-20", "00:00") },
    });
    await check("milestone", ms.id);
    expect(await db.todoDone.count()).toBe(2);

    await deleteLead("bsystems", lead.id, actor); // Lead → FollowUp cascade → mark
    expect(await db.todoDone.count()).toBe(1);

    const moneyLead = await db.wonDeal.findUniqueOrThrow({ where: { id: deal.id } });
    await deleteLead("bsystems", moneyLead.leadId, actor); // hand-deletes milestones → mark cascades
    expect(await db.todoDone.count()).toBe(0);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { cairoToUtc, utcToCairo } from "@/lib/datetime";
import { cairoDayWindow, todoFor } from "./todo";
import { setTodoDone } from "./todo-done";
import { applyLeadEvent } from "./leads";
import type { Actor } from "./activity";

/* ADR-041 — the To-Do projection: Cairo-day windowing, live-record selection,
   role scoping, admin extras. Fixed instants throughout — no wall-clock
   dependence (the Cairo boundary cases are the point).

   ADR-061 (founder): TODAY is the only list — no overdue — and the partner/
   agent pipeline rows are gone from the projection entirely. The money kinds
   (statement/milestone) keep due-before-end-of-today so a payment expected
   yesterday still shows under Today. */

const NOW = cairoToUtc("2026-08-20", "12:00");

function makeLead(opts: {
  name: string;
  stage: string;
  ownerType?: string;
  ownerUserId?: string | null;
}) {
  return db.lead.create({
    data: {
      brand: "bsystems",
      name: opts.name,
      number: "0100000000",
      type: "cold_call",
      stage: opts.stage,
      ownerType: opts.ownerType ?? "internal",
      ownerUserId: opts.ownerUserId ?? null,
    },
  });
}

function fu(leadId: string, dueAt: Date, createdAt?: Date) {
  return db.followUp.create({
    data: { leadId, context: "initial", dueAt, method: "call", ...(createdAt ? { createdAt } : {}) },
  });
}

beforeEach(async () => {
  await resetDb();
});

describe("To-Do aggregation (ADR-041)", () => {
  it("buckets by the CAIRO day: early-morning Cairo counts as today; yesterday and tomorrow do not appear at all (ADR-061)", async () => {
    const a = await makeLead({ name: "Today Early", stage: "following_up" });
    const b = await makeLead({ name: "Yesterday", stage: "following_up" });
    const c = await makeLead({ name: "Tomorrow", stage: "following_up" });
    await fu(a.id, cairoToUtc("2026-08-20", "00:30")); // 2026-08-19T21:30Z — still TODAY in Cairo
    await fu(b.id, cairoToUtc("2026-08-19", "23:00"));
    await fu(c.id, cairoToUtc("2026-08-21", "09:00"));

    /* ADR-061: the overdue list is GONE — yesterday's follow-up is invisible
       here by the founder's instruction (the board card still shows it) */
    const lists = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(lists.today.map((i) => i.title)).toEqual(["Today Early"]);
    expect("overdue" in lists).toBe(false);
  });

  it("only the lead's LATEST live record counts; leads that left the stage drop off", async () => {
    const lead = await makeLead({ name: "Superseded", stage: "following_up" });
    /* the superseded record is dated TODAY on purpose: if the latest-record
       rule broke, it would land in the only list there is (ADR-061) */
    await fu(lead.id, cairoToUtc("2026-08-20", "10:00"), new Date("2026-08-17T00:00:00Z"));
    await fu(lead.id, cairoToUtc("2026-08-25", "10:00"), new Date("2026-08-19T00:00:00Z")); // latest, future
    const moved = await makeLead({ name: "Moved On", stage: "sending_proposal" });
    await fu(moved.id, cairoToUtc("2026-08-20", "10:00"));

    const lists = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(lists.today).toEqual([]);
  });

  it("hardening: a B-6 groupless proposal-sent return leaves the PROPOSAL as latest — the stale follow-up never resurfaces", async () => {
    const lead = await makeLead({ name: "B6 Return", stage: "following_up" });
    /* pre-proposal follow-up (older) — dated TODAY so a broken latest-record
       rule would surface it in the only list there is (ADR-061) */
    await fu(lead.id, cairoToUtc("2026-08-20", "10:00"), new Date("2026-08-14T00:00:00Z"));
    /* the proposal record is the lead's newest — created when it entered
       sending_proposal; the B-6 auto-return adds NO new follow-up */
    await db.proposal.create({
      data: {
        leadId: lead.id,
        service: "x",
        sent: true,
        createdAt: new Date("2026-08-16T00:00:00Z"),
      },
    });

    const lists = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(lists.today).toEqual([]); // the stale follow-up must NOT be here
  });

  it("hardening: a stale arranged meeting never resurfaces past a newer unarranged one", async () => {
    const lead = await makeLead({ name: "Stale Meeting", stage: "meeting_setting" });
    await db.meeting.create({
      data: {
        leadId: lead.id,
        arranged: true,
        datetime: cairoToUtc("2026-08-20", "15:00"),
        createdAt: new Date("2026-08-14T00:00:00Z"), // old arranged meeting, today
      },
    });
    await db.meeting.create({
      data: {
        leadId: lead.id,
        arranged: false,
        datetime: cairoToUtc("2026-08-22", "15:00"),
        createdAt: new Date("2026-08-16T00:00:00Z"), // NEWEST record — a proposed slot
      },
    });
    const lists = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(lists.today).toEqual([]); // the stale arranged meeting must NOT show

    /* control: when the latest record IS an arranged outcome-less meeting
       dated today, the row appears */
    const live = await makeLead({ name: "Live Meeting", stage: "meeting_setting" });
    await db.meeting.create({
      data: { leadId: live.id, arranged: true, datetime: cairoToUtc("2026-08-20", "16:00") },
    });
    const lists2 = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(lists2.today.map((i) => i.title)).toEqual(["Live Meeting"]);
  });

  it("scopes: agent sees only own leads; internal sales the internal bucket; admin everything", async () => {
    const agent = await db.user.create({
      data: { name: "Scoped Agent", phone: "+201099911122", passwordHash: "x" },
    });
    const own = await makeLead({
      name: "Agent Own",
      stage: "following_up",
      ownerType: "agent",
      ownerUserId: agent.id,
    });
    const internal = await makeLead({ name: "Internal Lead", stage: "following_up" });
    const other = await makeLead({
      name: "Other Bucket",
      stage: "following_up",
      ownerType: "agent",
      ownerUserId: null,
    });
    await fu(own.id, cairoToUtc("2026-08-20", "09:00"));
    await fu(internal.id, cairoToUtc("2026-08-20", "10:00"));
    await fu(other.id, cairoToUtc("2026-08-20", "11:00"));

    const agentLists = await todoFor({
      brand: "bsystems",
      scope: { kind: "own", userId: agent.id },
      now: NOW,
    });
    expect(agentLists.today.map((i) => i.title)).toEqual(["Agent Own"]);

    const salesLists = await todoFor({ brand: "bsystems", scope: { kind: "internal" }, now: NOW });
    expect(salesLists.today.map((i) => i.title)).toEqual(["Internal Lead"]);

    const adminLists = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(adminLists.today.map((i) => i.title)).toEqual([
      "Agent Own",
      "Internal Lead",
      "Other Bucket",
    ]);
  });

  it("admin extras: live meetings, pending statements and open milestones due today — sales see none of the extras", async () => {
    const ml = await makeLead({ name: "Meeting Lead", stage: "meeting_setting" });
    await db.meeting.create({
      data: { leadId: ml.id, arranged: true, datetime: cairoToUtc("2026-08-20", "15:00") },
    });

    const wl = await makeLead({ name: "Won Lead", stage: "won" });
    const deal = await db.wonDeal.create({
      data: { leadId: wl.id, estimatedValue: 1000, totalCommissionPercent: 1000 },
    });
    await db.milestone.create({
      data: { wonDealId: deal.id, index: 1, value: 500, expectedEnd: cairoToUtc("2026-08-20", "00:00") },
    });
    await db.milestone.create({
      data: {
        wonDealId: deal.id,
        index: 2,
        value: 500,
        expectedEnd: cairoToUtc("2026-08-20", "00:00"),
        completed: true, // completed → never listed
      },
    });
    const m3 = await db.milestone.create({ data: { wonDealId: deal.id, index: 3, value: 0 } });
    await db.statement.create({
      data: {
        code: "ST-9001",
        milestoneId: m3.id,
        clientName: "Won Lead",
        milestoneLabel: "M3",
        milestoneValue: 0,
        percentBp: 0,
        amount: 0,
        closerLabel: "x",
        status: "pending",
        expectedDate: cairoToUtc("2026-08-20", "00:00"),
      },
    });

    const admin = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(admin.today.map((i) => i.kind).sort()).toEqual(["meeting", "milestone", "statement"]);

    const sales = await todoFor({ brand: "bsystems", scope: { kind: "internal" }, now: NOW });
    expect(sales.today.map((i) => i.kind)).toEqual(["meeting"]); // extras are admin-only
  });

  /* Founder — "I can assign these to do as an admin or just take it myself".
     A to-do is a projection over a LEAD's dated records, so a lead-backed row
     carries that lead's ownership and the page can hand it over with the
     existing assign machinery. Statement / milestone rows are admin-owned
     subsystems: there is nobody to hand them to, so they stay bare — which is
     exactly what hides the controls on those rows. (Prospect rows used to be
     the third bare kind; ADR-061 removed them from the projection outright.) */
  it("lead-backed rows carry the lead's id and owner; a prospect card yields NO row at all", async () => {
    const agent = await db.user.create({
      data: { name: "Owning Agent", phone: "+201099911133", passwordHash: "x" },
    });
    const owned = await makeLead({
      name: "Owned Lead",
      stage: "following_up",
      ownerType: "agent",
      ownerUserId: agent.id,
    });
    await fu(owned.id, cairoToUtc("2026-08-20", "09:00"));
    const unowned = await makeLead({ name: "Unowned Lead", stage: "following_up" });
    await fu(unowned.id, cairoToUtc("2026-08-20", "10:00"));
    const meetingLead = await makeLead({
      name: "Owned Meeting Lead",
      stage: "meeting_setting",
      ownerType: "agent",
      ownerUserId: agent.id,
    });
    await db.meeting.create({
      data: {
        leadId: meetingLead.id,
        arranged: true,
        datetime: cairoToUtc("2026-08-20", "11:00"),
      },
    });
    const prospect = await db.partnerProspect.create({
      data: {
        name: "Prospect Person",
        companyName: "Prospect Co",
        number: "0100000001",
        businessActivity: "Consulting",
        stage: "contacted",
      },
    });
    await db.followUp.create({
      data: {
        partnerProspectId: prospect.id,
        context: "initial",
        dueAt: cairoToUtc("2026-08-20", "12:00"),
        method: "call",
      },
    });

    const lists = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    const byTitle = new Map(lists.today.map((i) => [i.title, i]));

    expect(byTitle.get("Owned Lead")).toMatchObject({
      kind: "follow_up",
      withTime: false, // ADR-061: a follow-up is a DAY — the row hides the clock
      leadId: owned.id,
      ownerUserId: agent.id,
      ownerName: "Owning Agent",
      ownerType: "agent",
    });
    /* the admin bucket's unassigned state: a lead id to hand over, no owner */
    expect(byTitle.get("Unowned Lead")).toMatchObject({
      leadId: unowned.id,
      ownerUserId: null,
      ownerName: null,
      ownerType: "internal",
    });
    expect(byTitle.get("Owned Meeting Lead")).toMatchObject({
      kind: "meeting",
      withTime: true, // a meeting genuinely has a time and keeps it (ADR-061)
      leadId: meetingLead.id,
      ownerUserId: agent.id,
      ownerName: "Owning Agent",
    });

    /* ADR-061: the partners funnel is off the To-Do — even with a recorded
       follow-up due today, the card produces NO row */
    expect(byTitle.get("Prospect Co")).toBeUndefined();
  });

  /* ADR-061 — the deliberate asymmetry: the founder removed OVERDUE, but a
     statement or milestone expected before today is pending MONEY, not a
     missed call — it keeps showing under Today until it is settled. */
  it("money does not vanish: a statement/milestone expected YESTERDAY still shows under Today; an overdue follow-up does not", async () => {
    const missed = await makeLead({ name: "Missed Call", stage: "following_up" });
    await fu(missed.id, cairoToUtc("2026-08-19", "10:00")); // overdue → invisible

    const wl = await makeLead({ name: "Money Lead", stage: "won" });
    const deal = await db.wonDeal.create({
      data: { leadId: wl.id, estimatedValue: 1000, totalCommissionPercent: 1000 },
    });
    await db.milestone.create({
      data: {
        wonDealId: deal.id,
        index: 1,
        value: 500,
        expectedEnd: cairoToUtc("2026-08-19", "00:00"), // yesterday
      },
    });
    const m2 = await db.milestone.create({ data: { wonDealId: deal.id, index: 2, value: 500 } });
    await db.statement.create({
      data: {
        code: "ST-9002",
        milestoneId: m2.id,
        clientName: "Money Lead",
        milestoneLabel: "M2",
        milestoneValue: 0,
        percentBp: 0,
        amount: 0,
        closerLabel: "x",
        status: "pending",
        expectedDate: cairoToUtc("2026-08-19", "00:00"), // yesterday
      },
    });

    const lists = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(lists.today.map((i) => i.kind).sort()).toEqual(["milestone", "statement"]);
    expect(lists.today.map((i) => i.title)).not.toContain("Missed Call");
  });

  /* Review — the To-Do is the screen the admin uses to decide whom to hand a
     task to, so its owner name must be the SAME three-way name the board, the
     Leads table and the lead detail show: owner account, else internal rep,
     else the referring partner company. A lead that IS assigned must never
     read as unassigned there just because it has no owner ACCOUNT (an internal
     rep is a card, not a login; a partner converts without one when it has no
     email). Only ADR-051's real unassigned state — internal bucket, no rep, no
     account — keeps a null name. */
  it("the owner name falls back rep → partner company, exactly like every other owner surface", async () => {
    const rep = await db.salesRep.create({ data: { brand: "bsystems", name: "Omar Rep" } });
    const prospect = await db.partnerProspect.create({
      data: {
        name: "Nile Key Person",
        companyName: "Nile Co",
        number: "0100000077",
        businessActivity: "Consulting",
        stage: "won",
        converted: true,
      },
    });
    const partner = await db.partner.create({
      data: {
        prospectId: prospect.id,
        companyName: "Nile Co",
        keyPersonName: "Nile Key Person",
        keyPersonRole: "CEO",
        address: "1 Nile St",
        number: "0100000077",
        businessActivity: "Consulting",
        importance: "high",
      },
    });

    const repLead = await makeLead({ name: "Rep Lead", stage: "following_up" });
    await db.lead.update({ where: { id: repLead.id }, data: { salesRepId: rep.id } });
    await fu(repLead.id, cairoToUtc("2026-08-20", "09:00"));

    // partner-sourced lead whose partner company has no login (Partner.userId null)
    const partnerLead = await makeLead({
      name: "Partner Lead",
      stage: "following_up",
      ownerType: "partner",
    });
    await db.lead.update({
      where: { id: partnerLead.id },
      data: { partnerId: partner.id, source: "partner" },
    });
    await fu(partnerLead.id, cairoToUtc("2026-08-20", "10:00"));

    const bare = await makeLead({ name: "Bare Lead", stage: "following_up" });
    await fu(bare.id, cairoToUtc("2026-08-20", "11:00"));

    const lists = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    const byTitle = new Map(lists.today.map((i) => [i.title, i]));
    expect(byTitle.get("Rep Lead")).toMatchObject({ ownerName: "Omar Rep", ownerType: "internal" });
    expect(byTitle.get("Partner Lead")).toMatchObject({
      ownerName: "Nile Co",
      ownerUserId: null,
      ownerType: "partner",
    });
    expect(byTitle.get("Bare Lead")).toMatchObject({ ownerName: null, ownerType: "internal" });
  });
});

describe("cairoDayWindow DST boundaries (hardening)", () => {
  it("spring-forward at midnight (2026-04-24): the day starts at the first EXISTING instant; the eve keeps its last hour", () => {
    const { start } = cairoDayWindow(cairoToUtc("2026-04-24", "12:00"));
    expect(utcToCairo(start).date).toBe("2026-04-24");
    expect(utcToCairo(new Date(start.getTime() - 60_000)).date).toBe("2026-04-23");

    /* 23:30 on the eve belongs to the EVE's window, and the two windows
       stay contiguous across the jump */
    const eve = cairoToUtc("2026-04-23", "23:30");
    const eveWin = cairoDayWindow(cairoToUtc("2026-04-23", "12:00"));
    expect(eve.getTime() >= eveWin.start.getTime()).toBe(true);
    expect(eve.getTime() < eveWin.end.getTime()).toBe(true);
    expect(eveWin.end.getTime()).toBe(start.getTime());
  });

  it("fall-back day stays contiguous", () => {
    const a = cairoDayWindow(cairoToUtc("2026-10-29", "12:00"));
    const b = cairoDayWindow(cairoToUtc("2026-10-30", "12:00"));
    expect(a.end.getTime()).toBe(b.start.getTime());
    expect(utcToCairo(b.start).date).toBe("2026-10-30");
  });
});

/* ADR-061 superseded the ADR-059 projection here. ADR-059 made prospect rows
   record-driven ("a follow-up is a RECORD, never a column"); the founder then
   asked to "remove the partners tasks from the to do" outright. The records,
   boards and panels on the PIPELINE side are untouched — the To-Do simply no
   longer lists ANY prospect row. These guards keep the removal honest in
   every direction a row used to appear from: no stage, no recorded follow-up,
   no arranged meeting brings a partner/agent card back. */
describe("Partner tasks are OFF the To-Do (ADR-061)", () => {
  async function prospect(kind: string, stage: string, name: string) {
    return db.partnerProspect.create({
      data: {
        kind,
        name,
        number: "0100000055",
        stage,
        ...(kind === "partner"
          ? { companyName: `${name} Co`, businessActivity: "Consulting" }
          : { address: "3 Dokki St", speciality: "ERP consulting" }),
      },
    });
  }

  function prospectFollowUp(partnerProspectId: string, at: Date, createdAt?: Date) {
    return db.followUp.create({
      data: {
        partnerProspectId,
        context: "initial",
        dueAt: at,
        method: "call",
        ...(createdAt ? { createdAt } : {}),
      },
    });
  }

  const todayRows = async () => {
    const lists = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    return lists.today;
  };

  it("a follow-up recorded on ANY active stage — due today — yields no To-Do row", async () => {
    for (const [stage, name] of [
      ["lead", "Early Bird"],
      ["contacted", "Mounir Fahmy"],
      ["didnt_answer", "Unreachable"],
      ["waiting", "Holding Pattern"],
      ["meeting_setting", "Almost There"],
    ] as const) {
      const p = await prospect("agent", stage, name);
      await prospectFollowUp(p.id, cairoToUtc("2026-08-20", "10:00"));
    }
    expect(await todayRows()).toEqual([]);
  });

  it("an arranged, unresolved prospect meeting dated today yields no row either — nor a Done row (ADR-062)", async () => {
    const p = await prospect("partner", "meeting_setting", "Both");
    await db.meeting.create({
      data: {
        partnerProspectId: p.id,
        arranged: true,
        datetime: cairoToUtc("2026-08-20", "16:00"),
      },
    });
    expect(await todayRows()).toEqual([]);
    const lists = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(lists.done).toEqual([]); // the partners funnel reaches NO section
  });

  it("and a partner card with both records due today still yields nothing — while a LEAD's follow-up shows as ever", async () => {
    const p = await prospect("partner", "meeting_setting", "Loud");
    await db.meeting.create({
      data: {
        partnerProspectId: p.id,
        arranged: true,
        datetime: cairoToUtc("2026-08-20", "16:00"),
        createdAt: cairoToUtc("2026-08-18", "09:00"),
      },
    });
    await prospectFollowUp(
      p.id,
      cairoToUtc("2026-08-20", "10:00"),
      cairoToUtc("2026-08-19", "09:00"),
    );
    /* control: the projection itself still works — a CRM lead's follow-up due
       today is exactly as visible as before */
    const lead = await db.lead.create({
      data: {
        brand: "bsystems",
        name: "Control Lead",
        number: "0100000066",
        type: "cold_call",
        stage: "following_up",
        ownerType: "internal",
      },
    });
    await db.followUp.create({
      data: {
        leadId: lead.id,
        context: "initial",
        dueAt: cairoToUtc("2026-08-20", "10:00"),
        method: "call",
      },
    });
    const rows = await todayRows();
    expect(rows.map((r) => r.title)).toEqual(["Control Lead"]);
    expect(rows[0]!.kind).toBe("follow_up");
  });
});

/* ADR-062 — founder 2.2/2.3: "the corresponding task should remain visible in
   the To-Do List until the required action is completed", completed either
   MANUALLY (checkbox → TodoDone mark) or AUTOMATICALLY (the CRM moved on).
   Completed tasks leave Today and land in a DONE section — derived for the
   auto half, day-scoped for the manual half — instead of vanishing. */
describe("To-Do completion — the Done section (ADR-062)", () => {
  const elmur: Actor = { id: null, label: "Elmur" };
  const adminLists = () => todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
  const checkNow = (kind: "follow_up" | "meeting" | "statement" | "milestone", recordId: string) =>
    setTodoDone({ brand: "bsystems", kind, recordId, done: true, actor: elmur, now: NOW });

  it("MANUAL: a checked follow-up leaves Today and shows under Done with the completer's name; unchecking restores it", async () => {
    const lead = await makeLead({ name: "Checked Lead", stage: "following_up" });
    const f = await fu(lead.id, cairoToUtc("2026-08-20", "09:00"));

    await checkNow("follow_up", f.id);
    const lists = await adminLists();
    expect(lists.today).toEqual([]);
    expect(lists.done).toHaveLength(1);
    expect(lists.done[0]).toMatchObject({
      kind: "follow_up",
      recordId: f.id,
      leadId: lead.id,
      done: { by: "manual", name: "Elmur" },
    });

    /* the restore: done → uncheck → back under Today, unchecked */
    await setTodoDone({
      brand: "bsystems",
      kind: "follow_up",
      recordId: f.id,
      done: false,
      actor: elmur,
      now: NOW,
    });
    const restored = await adminLists();
    expect(restored.today.map((i) => i.recordId)).toEqual([f.id]);
    expect(restored.done).toEqual([]);
  });

  it("MANUAL marks are day-scoped: yesterday's mark neither hides today's task nor lists under today's Done", async () => {
    const lead = await makeLead({ name: "Stale Mark", stage: "following_up" });
    const f = await fu(lead.id, cairoToUtc("2026-08-20", "09:00"));
    /* a mark stamped YESTERDAY (bypassing the service — its liveness gate
       would refuse it today, which is the point of the projection-side rule) */
    await db.todoDone.create({
      data: {
        followUpId: f.id,
        dueAt: f.dueAt,
        completedByLabel: "Elmur",
        completedAt: cairoToUtc("2026-08-19", "12:00"),
      },
    });
    const lists = await adminLists();
    expect(lists.today.map((i) => i.recordId)).toEqual([f.id]); // unchecked again
    expect(lists.done).toEqual([]);
  });

  it("IDENTITY: the dueAt snapshot — a meeting checked done then rescheduled to later TODAY returns unchecked (same id, new instant)", async () => {
    const lead = await makeLead({ name: "Resched Lead", stage: "meeting_setting" });
    const m = await db.meeting.create({
      data: { leadId: lead.id, arranged: true, datetime: cairoToUtc("2026-08-20", "10:00") },
    });
    await checkNow("meeting", m.id);
    expect((await adminLists()).done.map((i) => i.recordId)).toEqual([m.id]);

    /* the reschedule path edits the SAME row in place (leads.ts) */
    await db.meeting.update({
      where: { id: m.id },
      data: { datetime: cairoToUtc("2026-08-20", "17:00") },
    });
    const lists = await adminLists();
    expect(lists.today.map((i) => i.recordId)).toEqual([m.id]); // back, unchecked
    expect(lists.done).toEqual([]); // the stale mark is not honoured anywhere
  });

  it("AUTO by stage move — the founder's own example: the follow-up completes when the lead reaches Meeting Setting, and auto beats a manual check", async () => {
    const lead = await makeLead({ name: "Moving Lead", stage: "following_up" });
    const f = await fu(lead.id, cairoToUtc("2026-08-20", "09:00"));
    /* the founder checked it first — the CRM move must still own the row */
    await checkNow("follow_up", f.id);

    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "drag", to: "meeting_setting" },
      group: {
        group: "meeting",
        data: { arranged: true, date: "2026-08-20", time: "15:00", mode: "online" },
      },
      actor: elmur,
      role: "bsystems_admin",
    });

    const lists = await adminLists();
    /* Today now shows the NEW meeting task; the old follow-up sits under Done
       with the moved reason — not manual, so it is not restorable */
    expect(lists.today.map((i) => i.kind)).toEqual(["meeting"]);
    const doneFollowUp = lists.done.find((i) => i.recordId === f.id);
    expect(doneFollowUp?.done).toEqual({ by: "auto", reason: "moved", stage: "meeting_setting" });
  });

  it("AUTO by supersession: a newer follow-up on the same lead completes the old one — and the new task arrives unchecked", async () => {
    const lead = await makeLead({ name: "Super Lead", stage: "following_up" });
    const oldF = await fu(
      lead.id,
      cairoToUtc("2026-08-20", "09:00"),
      new Date("2026-08-18T00:00:00Z"),
    );
    await checkNow("follow_up", oldF.id); // checked while it was live
    const newF = await fu(
      lead.id,
      cairoToUtc("2026-08-20", "15:00"),
      new Date("2026-08-19T00:00:00Z"),
    );

    const lists = await adminLists();
    expect(lists.today.map((i) => i.recordId)).toEqual([newF.id]); // B unchecked
    const done = lists.done.find((i) => i.recordId === oldF.id);
    expect(done?.done).toEqual({ by: "auto", reason: "superseded" }); // auto wins over the mark
  });

  it("AUTO by meeting outcome: the resolved meeting reads its outcome, not the stage it left for", async () => {
    const lead = await makeLead({ name: "Outcome Lead", stage: "meeting_setting" });
    await db.meeting.create({
      data: { leadId: lead.id, arranged: true, datetime: cairoToUtc("2026-08-20", "15:00") },
    });
    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "meeting_outcome", outcome: "attended", destination: "sending_proposal" },
      group: { group: "proposal", data: { service: "ERP rollout", sent: false } },
      actor: elmur,
      role: "bsystems_admin",
    });
    const lists = await adminLists();
    expect(lists.today).toEqual([]);
    expect(lists.done).toHaveLength(1);
    expect(lists.done[0]!.done).toEqual({
      by: "auto",
      reason: "meeting_outcome",
      outcome: "attended",
    });
  });

  it("MONEY: a checked statement hides for TODAY only — tomorrow it is back unchecked (money never vanishes); paid/completed land as auto-dones", async () => {
    const wl = await makeLead({ name: "Money Lead", stage: "won" });
    const deal = await db.wonDeal.create({
      data: { leadId: wl.id, estimatedValue: 1000, totalCommissionPercent: 1000 },
    });
    const ms = await db.milestone.create({
      data: {
        wonDealId: deal.id,
        index: 1,
        value: 500,
        expectedEnd: cairoToUtc("2026-08-20", "00:00"),
      },
    });
    const ms2 = await db.milestone.create({ data: { wonDealId: deal.id, index: 2, value: 500 } });
    const s = await db.statement.create({
      data: {
        code: "ST-9100",
        milestoneId: ms2.id,
        clientName: "Money Lead",
        milestoneLabel: "M2",
        milestoneValue: 0,
        percentBp: 0,
        amount: 0,
        closerLabel: "x",
        status: "pending",
        expectedDate: cairoToUtc("2026-08-19", "00:00"), // yesterday — still today's task
      },
    });

    await checkNow("statement", s.id);
    const lists = await adminLists();
    expect(lists.today.map((i) => i.kind)).toEqual(["milestone"]);
    expect(lists.done.map((i) => i.recordId)).toEqual([s.id]);
    expect(lists.done[0]!.done).toEqual({ by: "manual", name: "Elmur" });

    /* tomorrow: the mark's day has passed and the money is STILL pending */
    const tomorrow = await todoFor({
      brand: "bsystems",
      scope: { kind: "all" },
      now: cairoToUtc("2026-08-21", "12:00"),
    });
    expect(tomorrow.today.map((i) => i.recordId).sort()).toEqual([ms.id, s.id].sort());
    expect(tomorrow.done).toEqual([]);

    /* the AUTO half: paid today / completed today, expected on the list */
    await db.statement.update({
      where: { id: s.id },
      data: { status: "paid", paidAt: cairoToUtc("2026-08-20", "13:00") },
    });
    await db.milestone.update({
      where: { id: ms.id },
      data: { completed: true, completedAt: cairoToUtc("2026-08-20", "14:00") },
    });
    const after = await adminLists();
    expect(after.today).toEqual([]);
    const reasons = Object.fromEntries(after.done.map((i) => [i.recordId, i.done]));
    expect(reasons[s.id]).toEqual({ by: "auto", reason: "statement_paid" });
    expect(reasons[ms.id]).toEqual({ by: "auto", reason: "milestone_completed" });

    /* the correction path: unchecking the milestone puts the task back */
    await db.milestone.update({
      where: { id: ms.id },
      data: { completed: false, completedAt: null },
    });
    const corrected = await adminLists();
    expect(corrected.today.map((i) => i.recordId)).toEqual([ms.id]);
  });

  it("SCOPE: an agent's Done section carries only his own leads — sales only the internal bucket", async () => {
    const agent = await db.user.create({
      data: { name: "Scoped Agent", phone: "+201099911144", passwordHash: "x" },
    });
    const own = await makeLead({
      name: "Agent Done",
      stage: "meeting_setting", // moved on — its follow-up auto-completed
      ownerType: "agent",
      ownerUserId: agent.id,
    });
    await fu(own.id, cairoToUtc("2026-08-20", "09:00"));
    const other = await makeLead({ name: "Internal Done", stage: "meeting_setting" });
    await fu(other.id, cairoToUtc("2026-08-20", "10:00"));

    const agentLists = await todoFor({
      brand: "bsystems",
      scope: { kind: "own", userId: agent.id },
      now: NOW,
    });
    expect(agentLists.done.map((i) => i.title)).toEqual(["Agent Done"]);

    const salesLists = await todoFor({ brand: "bsystems", scope: { kind: "internal" }, now: NOW });
    expect(salesLists.done.map((i) => i.title)).toEqual(["Internal Done"]);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { cairoToUtc, utcToCairo } from "@/lib/datetime";
import { cairoDayWindow, todoFor } from "./todo";

/* ADR-041 — the To-Do projection: Cairo-day windowing, live-record selection,
   role scoping, admin extras. Fixed instants throughout — no wall-clock
   dependence (the Cairo boundary cases are the point). */

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
  it("buckets by the CAIRO day: early-morning Cairo counts as today, yesterday as overdue, tomorrow as neither", async () => {
    const a = await makeLead({ name: "Today Early", stage: "following_up" });
    const b = await makeLead({ name: "Yesterday", stage: "following_up" });
    const c = await makeLead({ name: "Tomorrow", stage: "following_up" });
    await fu(a.id, cairoToUtc("2026-08-20", "00:30")); // 2026-08-19T21:30Z — still TODAY in Cairo
    await fu(b.id, cairoToUtc("2026-08-19", "23:00"));
    await fu(c.id, cairoToUtc("2026-08-21", "09:00"));

    const lists = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(lists.today.map((i) => i.title)).toEqual(["Today Early"]);
    expect(lists.overdue.map((i) => i.title)).toEqual(["Yesterday"]);
  });

  it("only the lead's LATEST live record counts; leads that left the stage drop off", async () => {
    const lead = await makeLead({ name: "Superseded", stage: "following_up" });
    await fu(lead.id, cairoToUtc("2026-08-18", "10:00"), new Date("2026-08-17T00:00:00Z")); // old, overdue
    await fu(lead.id, cairoToUtc("2026-08-25", "10:00"), new Date("2026-08-19T00:00:00Z")); // latest, future
    const moved = await makeLead({ name: "Moved On", stage: "sending_proposal" });
    await fu(moved.id, cairoToUtc("2026-08-20", "10:00"));

    const lists = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(lists.today).toEqual([]);
    expect(lists.overdue).toEqual([]);
  });

  it("hardening: a B-6 groupless proposal-sent return leaves the PROPOSAL as latest — the stale follow-up never resurfaces", async () => {
    const lead = await makeLead({ name: "B6 Return", stage: "following_up" });
    /* pre-proposal follow-up (older), overdue by NOW */
    await fu(lead.id, cairoToUtc("2026-08-15", "10:00"), new Date("2026-08-14T00:00:00Z"));
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
    expect(lists.today).toEqual([]);
    expect(lists.overdue).toEqual([]); // the stale follow-up must NOT be here
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
     existing assign machinery. Partner-prospect / statement / milestone rows
     are admin-owned subsystems: there is nobody to hand them to, so they stay
     bare — which is exactly what hides the controls on those rows. */
  it("lead-backed rows carry the lead's id and owner; prospect rows carry none", async () => {
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
        stage: "following_up",
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
      leadId: meetingLead.id,
      ownerUserId: agent.id,
      ownerName: "Owning Agent",
    });

    const prospectRow = byTitle.get("Prospect Co");
    expect(prospectRow?.kind).toBe("prospect_follow_up");
    expect(prospectRow?.leadId).toBeUndefined();
    expect(prospectRow?.ownerUserId).toBeUndefined();
    expect(prospectRow?.ownerName).toBeUndefined();
    expect(prospectRow?.ownerType).toBeUndefined();
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

/* ADR-057 — the silent-loss guard. An agent's dated follow-up lives in
   `contacted`, not `following_up`; if the To-Do query is ever narrowed back to
   the partner literal, every agent follow-up drops off the admin's most-used
   screen with no error, no log and no empty state. */
describe("To-Do carries BOTH kinds of prospect follow-up (ADR-057)", () => {
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

  it("an AGENT in Contacted and a PARTNER in Following Up both surface, titled their own way", async () => {
    const agent = await prospect("agent", "contacted", "Mounir Fahmy");
    await prospectFollowUp(agent.id, cairoToUtc("2026-08-20", "10:00"));
    const partner = await prospect("partner", "following_up", "Nile");
    await prospectFollowUp(partner.id, cairoToUtc("2026-08-20", "11:00"));

    const lists = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    const rows = lists.today.filter((i) => i.kind === "prospect_follow_up");
    /* the agent IS the card, so his own name titles the row; a partner card
       still reads as its company */
    expect(rows.map((r) => r.title).sort()).toEqual(["Mounir Fahmy", "Nile Co"]);
    for (const r of rows) {
      expect(r.leadId).toBeUndefined();
      expect(r.ownerUserId).toBeUndefined();
    }
  });

  it("the latest-record rule survives the rename, and terminal agent cards produce nothing", async () => {
    /* a newer meeting supersedes the follow-up — no row, exactly as for partners */
    const superseded = await prospect("agent", "contacted", "Superseded Agent");
    await prospectFollowUp(
      superseded.id,
      cairoToUtc("2026-08-20", "10:00"),
      cairoToUtc("2026-08-18", "09:00"),
    );
    await db.meeting.create({
      data: {
        partnerProspectId: superseded.id,
        arranged: true,
        datetime: cairoToUtc("2026-08-20", "15:00"),
        createdAt: cairoToUtc("2026-08-19", "09:00"),
      },
    });

    for (const [stage, name] of [
      ["qualified", "Qualified Agent"],
      ["lost", "Lost Agent"],
      ["lead", "Lead Agent"],
    ] as const) {
      const p = await prospect("agent", stage, name);
      await prospectFollowUp(p.id, cairoToUtc("2026-08-20", "10:00"));
    }

    const lists = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW });
    expect(lists.today.filter((i) => i.kind === "prospect_follow_up")).toEqual([]);
    expect(lists.overdue.filter((i) => i.kind === "prospect_follow_up")).toEqual([]);
  });
});

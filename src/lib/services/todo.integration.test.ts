import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { cairoToUtc } from "@/lib/datetime";
import { todoFor } from "./todo";

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
});

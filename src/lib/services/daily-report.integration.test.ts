import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { cairoToUtc, utcToCairo } from "@/lib/datetime";
import {
  applyLeadEvent,
  assignLeadOwner,
  createLead,
  deleteLead,
  markReadyToClose,
  setArchived,
  setNoAnswer,
  updateLead,
} from "./leads";
import { addLeadComment } from "./comments";
import { markLeadWhatsappSent } from "./whatsapp";
import { updateProposal } from "./proposals";
import { performUndo } from "./undo";
import { deleteUser } from "./users";
import {
  dailyReportFor,
  isViaLabel,
  type DailyReport,
  type ReportCompany,
} from "./daily-report";
import type { Actor } from "./activity";

/* ============================================================================
   ADR-081 — THE DAILY REPORT, tested from the two sides that can be wrong.

   UNDERCOUNTING is the first: the headline number he asked for twice is only as
   good as the inventory behind it, so there is a case per writer in the product
   that touches a lead, and a deleted or out-of-scope lead is still COUNTED (as a
   redacted row) rather than dropped.

   LEAKING is the second: every scope case seeds a COLLEAGUE's action, on the
   SAME lead, inside the SAME window, FIRST. A test that seeded only the viewer's
   own rows would pass just as happily against a service with no actor predicate
   and no scope predicate at all, which is exactly the bug worth catching
   (ADR-071's own lesson, applied).
   ========================================================================== */

/* A fixed "now", so nothing here depends on the day the suite runs. */
const NOW = cairoToUtc("2026-09-26", "14:00");
const TODAY = "2026-09-26";
const YESTERDAY = "2026-09-25";
const TWO_AGO = "2026-09-24";

const ALL: ReportCompany[] = [
  { brand: "bsystems", scope: { kind: "all" } },
  { brand: "byteforce", scope: { kind: "all" } },
];

let seq = 0;

async function makeUser(name: string, roles: string[]): Promise<Actor & { userId: string }> {
  seq += 1;
  const user = await db.user.create({
    data: { name, phone: `+2010555${String(10_000 + seq)}`, passwordHash: "x" },
  });
  for (const role of roles) await db.userRole.create({ data: { userId: user.id, role } });
  return { id: user.id, label: user.name, userId: user.id };
}

async function makeLead(
  brand: "bsystems" | "byteforce",
  actor: Actor,
  name: string,
  opts?: { ownerType?: string; ownerUserId?: string },
) {
  seq += 1;
  return createLead(
    brand,
    { name, number: `0105${String(100_000 + seq)}`, type: "cold_call" },
    actor,
    opts as never,
  );
}

/* Perform real service calls and then RE-STAMP the ActivityLog rows they wrote
   onto a chosen instant. The rows themselves are the product's own — the real
   trigger, the real action, the real from/to stages — which is the only way a
   test of this projection can be honest about the inventory; only WHEN they
   happened is controlled, because `createdAt` defaults to now(). Two rows
   written in ONE transaction keep the identical instant here exactly as they do
   in production. */
async function at<T>(when: Date, fn: () => Promise<T>): Promise<T> {
  const before = new Set((await db.activityLog.findMany({ select: { id: true } })).map((r) => r.id));
  const result = await fn();
  const fresh = (await db.activityLog.findMany({ select: { id: true } }))
    .map((r) => r.id)
    .filter((id) => !before.has(id));
  await db.activityLog.updateMany({ where: { id: { in: fresh } }, data: { createdAt: when } });
  return result;
}

const move = (
  brand: "bsystems" | "byteforce",
  leadId: string,
  action: string,
  actor: Actor,
  group?: unknown,
  role: string = brand === "byteforce" ? "byteforce_staff" : "bsystems_admin",
) =>
  applyLeadEvent({
    brand,
    leadId,
    event: { type: "next_action", action },
    group: group as never,
    actor,
    role: role as never,
  });

const followUp = (date: string) => ({
  group: "follow_up" as const,
  data: { date, method: "call" as const },
});
const meeting = (date: string, time: string) => ({
  group: "meeting" as const,
  data: { arranged: true, date, time, mode: "online" as const },
});

const dayOf = (report: DailyReport, date: string) => report.days.find((d) => d.date === date)!;
const triggersOn = (report: DailyReport, date: string, leadId: string) =>
  dayOf(report, date)
    .leads.find((l) => l.leadId === leadId)!
    .interactions.map((i) => i.trigger)
    .sort();

beforeEach(async () => {
  await resetDb();
  seq += 1;
});

/* ------------------------------------------------------------------ the shape */

describe("the three-day shape (founder: 'just the last three days')", () => {
  it("always returns exactly three Cairo days, newest first, even with no history at all", async () => {
    const me = await makeUser("Lonely Admin", ["bsystems_admin"]);
    const report = await dailyReportFor({ actorId: me.id!, companies: ALL, now: NOW });

    expect(report.days.map((d) => d.date)).toEqual([TODAY, YESTERDAY, TWO_AGO]);
    expect(report.days.map((d) => d.isToday)).toEqual([true, false, false]);
    for (const day of report.days) {
      expect(day.leadCount).toBe(0);
      expect(day.interactionCount).toBe(0);
      expect(day.leads).toEqual([]);
    }
  });

  it("an EMPTY DAY is an explicit zero, not a missing section", async () => {
    const me = await makeUser("Quiet Admin", ["bsystems_admin"]);
    const lead = await at(cairoToUtc(TWO_AGO, "11:00"), () =>
      makeLead("bsystems", me, "Two Days Ago Co"),
    );

    const report = await dailyReportFor({ actorId: me.id!, companies: ALL, now: NOW });
    expect(report.days).toHaveLength(3);
    expect(dayOf(report, TODAY).leadCount).toBe(0);
    expect(dayOf(report, YESTERDAY).leadCount).toBe(0);
    expect(dayOf(report, TWO_AGO).leadCount).toBe(1);
    expect(dayOf(report, TWO_AGO).leads[0]!.name).toBe("Two Days Ago Co");
    expect(dayOf(report, TWO_AGO).leads[0]!.leadId).toBe(lead.id);
  });

  it("a FOURTH day is unreachable — work three days ago is not in the window", async () => {
    const me = await makeUser("Historic Admin", ["bsystems_admin"]);
    await at(cairoToUtc("2026-09-23", "11:00"), () => makeLead("bsystems", me, "Four Days Ago Co"));
    await at(cairoToUtc(TWO_AGO, "23:59"), () => makeLead("bsystems", me, "Just Inside Co"));

    const report = await dailyReportFor({ actorId: me.id!, companies: ALL, now: NOW });
    const names = report.days.flatMap((d) => d.leads.map((l) => l.name));
    expect(names).toContain("Just Inside Co");
    expect(names).not.toContain("Four Days Ago Co");
    expect(report.days.map((d) => d.leadCount)).toEqual([0, 0, 1]);
  });

  it("the SEEDED demo history (actorId null, 'Seed') is nobody's day", async () => {
    const me = await makeUser("Fresh Admin", ["bsystems_admin"]);
    const lead = await makeLead("bsystems", { id: null, label: "Seed" }, "Seeded Co");
    await db.activityLog.updateMany({
      where: { entityId: lead.id },
      data: { createdAt: cairoToUtc(TODAY, "09:00") },
    });
    /* the row exists, it is TODAY's, and it names the lead — it just has no actor */
    expect(await db.activityLog.count({ where: { actorId: null } })).toBeGreaterThan(0);

    const report = await dailyReportFor({ actorId: me.id!, companies: ALL, now: NOW });
    expect(report.days.map((d) => d.leadCount)).toEqual([0, 0, 0]);
    expect(JSON.stringify(report)).not.toContain("Seeded Co");
  });
});

/* ------------------------------------------------- the count is DISTINCT leads */

describe("THE COUNT: distinct leads, never actions (he asked for the number twice)", () => {
  it("five actions on one lead in one day = ONE lead, ONE row, FIVE interaction lines", async () => {
    const me = await makeUser("Busy Admin", ["bsystems_admin"]);
    const lead = await at(cairoToUtc(TODAY, "09:00"), () => makeLead("bsystems", me, "Five Taps Co"));
    await at(cairoToUtc(TODAY, "10:00"), () => setNoAnswer("bsystems", lead.id, true, me));
    await at(cairoToUtc(TODAY, "11:00"), () =>
      addLeadComment({ leadId: lead.id, body: "rang again", author: { id: me.id!, name: me.label } }),
    );
    await at(cairoToUtc(TODAY, "12:00"), () => markLeadWhatsappSent("bsystems", lead.id, me));
    await at(cairoToUtc(TODAY, "13:00"), () => markReadyToClose("bsystems", lead.id, me));

    const report = await dailyReportFor({ actorId: me.id!, companies: ALL, now: NOW });
    const today = dayOf(report, TODAY);
    expect(today.leadCount).toBe(1);
    expect(today.leads).toHaveLength(1);
    expect(today.interactionCount).toBe(5);
    expect(today.leads[0]!.interactions).toHaveLength(5);
    /* newest first */
    expect(today.leads[0]!.interactions.map((i) => i.trigger)).toEqual([
      "B-RTC",
      "whatsapp_sent",
      "lead_chat",
      "no_answer",
      "create",
    ]);
  });

  it("the structural invariant, asserted directly: leadCount === distinct entityIds per day", async () => {
    const me = await makeUser("Counting Admin", ["bsystems_admin"]);
    const a = await at(cairoToUtc(TODAY, "09:00"), () => makeLead("bsystems", me, "Count A"));
    const b = await at(cairoToUtc(TODAY, "09:30"), () => makeLead("bsystems", me, "Count B"));
    await at(cairoToUtc(TODAY, "10:00"), () => setNoAnswer("bsystems", a.id, true, me));
    await at(cairoToUtc(YESTERDAY, "10:00"), () => setNoAnswer("bsystems", b.id, true, me));

    const report = await dailyReportFor({ actorId: me.id!, companies: ALL, now: NOW });
    for (const day of report.days) {
      const rows = await db.activityLog.findMany({
        where: { actorId: me.id, entityType: "lead" },
        select: { entityId: true, createdAt: true },
      });
      const distinct = new Set(
        rows.filter((r) => utcToCairo(r.createdAt).date === day.date).map((r) => r.entityId),
      );
      expect(day.leadCount).toBe(distinct.size);
      expect(day.leadCount).toBe(new Set(day.leads.map((l) => l.leadId)).size);
    }
    expect(dayOf(report, TODAY).leadCount).toBe(2);
    expect(dayOf(report, YESTERDAY).leadCount).toBe(1);
  });

  it("the same lead on two days is one row on EACH day, each day counting one", async () => {
    const me = await makeUser("Two Day Admin", ["bsystems_admin"]);
    const lead = await at(cairoToUtc(YESTERDAY, "09:00"), () =>
      makeLead("bsystems", me, "Both Days Co"),
    );
    await at(cairoToUtc(TODAY, "09:00"), () => setNoAnswer("bsystems", lead.id, true, me));

    const report = await dailyReportFor({ actorId: me.id!, companies: ALL, now: NOW });
    expect(dayOf(report, TODAY).leadCount).toBe(1);
    expect(dayOf(report, YESTERDAY).leadCount).toBe(1);
    expect(dayOf(report, TODAY).leads[0]!.leadId).toBe(lead.id);
    expect(dayOf(report, YESTERDAY).leads[0]!.leadId).toBe(lead.id);
  });

  it("TWO rows written in ONE transaction are two lines, never two leads", async () => {
    /* a stage move off a no-answer-flagged card writes `no_answer_cleared` AND
       the move row, inside the same transaction, with the same instant */
    const me = await makeUser("Transaction Admin", ["bsystems_admin"]);
    const lead = await at(cairoToUtc(YESTERDAY, "09:00"), () =>
      makeLead("bsystems", me, "One Transaction Co"),
    );
    await at(cairoToUtc(YESTERDAY, "10:00"), () => setNoAnswer("bsystems", lead.id, true, me));
    await at(cairoToUtc(TODAY, "10:00"), () =>
      move("bsystems", lead.id, "following_up", me, followUp(TODAY)),
    );

    const today = dayOf(await dailyReportFor({ actorId: me.id!, companies: ALL, now: NOW }), TODAY);
    expect(today.leadCount).toBe(1);
    expect(today.interactionCount).toBe(2);
    expect(today.leads[0]!.interactions.map((i) => i.trigger).sort()).toEqual([
      "B-1",
      "no_answer_cleared",
    ]);
  });
});

/* -------------------------------------------------------------- the inventory */

describe("THE INVENTORY — every place the product records that he touched a lead", () => {
  it("B-Systems: create, ready-to-close, didn't-answer + clear, archive + unarchive, assign, edit", async () => {
    const me = await makeUser("Inventory Admin", ["bsystems_admin"]);
    const agent = await makeUser("Inventory Agent", ["bsystems_agent"]);
    const lead = await at(cairoToUtc(TODAY, "08:00"), () => makeLead("bsystems", me, "Inventory Co"));
    await at(cairoToUtc(TODAY, "08:05"), () => markReadyToClose("bsystems", lead.id, me));
    await at(cairoToUtc(TODAY, "08:10"), () => setNoAnswer("bsystems", lead.id, true, me));
    await at(cairoToUtc(TODAY, "08:15"), () => setNoAnswer("bsystems", lead.id, false, me));
    await at(cairoToUtc(TODAY, "08:20"), () => setArchived("bsystems", lead.id, true, me));
    await at(cairoToUtc(TODAY, "08:25"), () => setArchived("bsystems", lead.id, false, me));
    await at(cairoToUtc(TODAY, "08:30"), () => assignLeadOwner(lead.id, agent.userId, me));
    await at(cairoToUtc(TODAY, "08:35"), () =>
      updateLead("bsystems", lead.id, { companyName: "Inventory Holdings" }, me),
    );

    const report = await dailyReportFor({ actorId: me.id!, companies: ALL, now: NOW });
    expect(triggersOn(report, TODAY, lead.id)).toEqual([
      "B-RTC",
      "archived",
      "assigned",
      "create",
      "edit",
      "no_answer",
      "no_answer_cleared",
      "unarchived",
    ]);
    expect(dayOf(report, TODAY).leadCount).toBe(1);
  });

  it("B-Systems: the pipeline — B-1, B-4, the same-stage records, the proposal edit and B-6", async () => {
    const me = await makeUser("Pipeline Admin", ["bsystems_admin"]);
    const lead = await at(cairoToUtc(TODAY, "08:00"), () => makeLead("bsystems", me, "Pipeline Co"));
    await at(cairoToUtc(TODAY, "08:05"), () =>
      move("bsystems", lead.id, "following_up", me, followUp(TODAY)),
    );
    await at(cairoToUtc(TODAY, "08:10"), () =>
      move("bsystems", lead.id, "follow_up_again", me, followUp(TODAY)),
    );
    await at(cairoToUtc(TODAY, "08:15"), () =>
      move("bsystems", lead.id, "meeting_setting", me, meeting(TODAY, "16:00")),
    );
    await at(cairoToUtc(TODAY, "08:20"), () =>
      move("bsystems", lead.id, "reschedule_meeting", me, meeting(TODAY, "18:00")),
    );
    await at(cairoToUtc(TODAY, "08:25"), () =>
      move("bsystems", lead.id, "sending_proposal", me, {
        group: "proposal",
        data: { service: "ERP", estimatedValue: 500_000, sent: false },
      }),
    );
    /* the AUTOMATIC return when the proposal is marked sent — B-6 */
    await at(cairoToUtc(TODAY, "08:30"), () =>
      applyLeadEvent({
        brand: "bsystems",
        leadId: lead.id,
        event: { type: "proposal_sent" },
        group: { group: "follow_up", data: { date: TODAY, method: "call" } } as never,
        actor: me,
        role: "bsystems_admin",
      }),
    );
    await at(cairoToUtc(TODAY, "08:35"), () =>
      move("bsystems", lead.id, "negotiation", me, {
        group: "negotiation",
        data: { note: "they want a discount" },
      }),
    );
    await at(cairoToUtc(TODAY, "08:40"), () =>
      move("bsystems", lead.id, "negotiation_follow_up", me, followUp(TODAY)),
    );
    const proposal = await db.proposal.findFirstOrThrow({ where: { leadId: lead.id } });
    await at(cairoToUtc(TODAY, "08:45"), () =>
      updateProposal(proposal.id, "bsystems", { service: "ERP + support", estimatedValue: 6000 }, me),
    );

    const report = await dailyReportFor({ actorId: me.id!, companies: ALL, now: NOW });
    expect(triggersOn(report, TODAY, lead.id)).toEqual([
      "B-1", // following_up
      "B-1", // sending_proposal
      "B-1", // meeting_setting
      "B-4", // negotiation
      "B-6", // the automatic proposal-sent return
      "FU-AGAIN",
      "MTG-RESCHEDULE",
      "NEG-DUE",
      "create",
      "proposal_edited",
    ]);
    /* the MOVE rows carry their stages, which is what lets the phrase survive a
       new §10 row — and the same-stage records deliberately carry none */
    const rows = dayOf(report, TODAY).leads[0]!.interactions;
    expect(rows.find((r) => r.trigger === "B-4")!.toStage).toBe("negotiation");
    expect(rows.find((r) => r.trigger === "FU-AGAIN")!.toStage).toBeNull();
    expect(rows.find((r) => r.trigger === "FU-AGAIN")!.action).toBe("group_added");
    expect(rows.find((r) => r.trigger === "B-6")!.action).toBe("auto_transfer");
  });

  it("B-Systems: the WIN writes the lead's own row, and the won-deal row is not a second lead", async () => {
    const me = await makeUser("Winning Admin", ["bsystems_admin"]);
    const lead = await at(cairoToUtc(TODAY, "08:00"), () => makeLead("bsystems", me, "Winner Co"));
    await at(cairoToUtc(TODAY, "09:00"), () =>
      move("bsystems", lead.id, "won", me, {
        group: "won_deal",
        data: {
          estimatedValue: 100_000,
          totalCommissionPercentBp: 1000,
          milestones: [{ label: "All", value: 100_000, commissionValue: 10_000 }],
        },
      }),
    );

    const today = dayOf(await dailyReportFor({ actorId: me.id!, companies: ALL, now: NOW }), TODAY);
    expect(today.leadCount).toBe(1); // NOT 2 — the won_deal row is a sibling
    expect(today.leads[0]!.interactions.map((i) => i.trigger).sort()).toEqual(["B-9", "create"]);
    /* the won_deal row really was written — this case is about it being EXCLUDED */
    expect(await db.activityLog.count({ where: { entityType: "won_deal" } })).toBe(1);
  });

  it("B-Systems: the meeting outcomes, and Postpone", async () => {
    const me = await makeUser("Outcome Admin", ["bsystems_admin"]);
    const lead = await at(cairoToUtc(TODAY, "08:00"), () => makeLead("bsystems", me, "Outcome Co"));
    await at(cairoToUtc(TODAY, "08:05"), () =>
      move("bsystems", lead.id, "meeting_setting", me, meeting(TODAY, "10:00")),
    );
    await at(cairoToUtc(TODAY, "08:10"), () =>
      applyLeadEvent({
        brand: "bsystems",
        leadId: lead.id,
        event: { type: "meeting_outcome", outcome: "delayed" },
        group: { group: "meeting_reschedule", data: { date: TODAY, time: "19:00" } } as never,
        actor: me,
        role: "bsystems_admin",
      }),
    );
    await at(cairoToUtc(TODAY, "08:15"), () =>
      move("bsystems", lead.id, "postponed", me, {
        group: "postpone",
        data: { reason: "not_answering" },
      }),
    );

    const report = await dailyReportFor({ actorId: me.id!, companies: ALL, now: NOW });
    expect(triggersOn(report, TODAY, lead.id)).toEqual(["B-1", "B-1", "B-7", "create"]);
    const rows = dayOf(report, TODAY).leads[0]!.interactions;
    expect(rows.filter((r) => r.toStage === "postponed")).toHaveLength(1);
  });

  it("ByteForce: its own row ids, on its own screen", async () => {
    const me = await makeUser("ByteForce Staff", ["byteforce_staff"]);
    const lead = await at(cairoToUtc(TODAY, "08:00"), () => makeLead("byteforce", me, "BF Co"));
    await at(cairoToUtc(TODAY, "08:05"), () =>
      move("byteforce", lead.id, "following_up", me, followUp(TODAY)),
    );
    await at(cairoToUtc(TODAY, "08:10"), () =>
      move("byteforce", lead.id, "meeting_setting", me, meeting(TODAY, "12:00")),
    );

    const report = await dailyReportFor({
      actorId: me.id!,
      companies: [{ brand: "byteforce", scope: { kind: "all" } }],
      now: NOW,
    });
    expect(triggersOn(report, TODAY, lead.id)).toEqual(["T-1", "T-2", "create"]);
    expect(dayOf(report, TODAY).leads[0]!.href).toBe(
      `/b-systems/leads/lead/${lead.id}?company=byteforce`,
    );
  });

  it("the UNDO he pressed is itself an interaction", async () => {
    const me = await makeUser("Undoing Admin", ["bsystems_admin"]);
    const lead = await at(cairoToUtc(YESTERDAY, "08:00"), () => makeLead("bsystems", me, "Undo Co"));
    await at(cairoToUtc(TODAY, "08:00"), () => setNoAnswer("bsystems", lead.id, true, me));
    await at(cairoToUtc(TODAY, "08:05"), () => performUndo(me));

    const report = await dailyReportFor({ actorId: me.id!, companies: ALL, now: NOW });
    expect(triggersOn(report, TODAY, lead.id)).toEqual(["no_answer", "undo"]);
  });

  it("deleting an OWNER writes one row per returned lead, attributed to the deleting admin", async () => {
    const me = await makeUser("Deleting Admin", ["bsystems_admin"]);
    const agent = await makeUser("Departing Agent", ["bsystems_agent"]);
    const one = await at(cairoToUtc(YESTERDAY, "08:00"), () =>
      makeLead("bsystems", me, "Returned One", {
        ownerType: "agent",
        ownerUserId: agent.userId,
      }),
    );
    const two = await at(cairoToUtc(YESTERDAY, "08:01"), () =>
      makeLead("bsystems", me, "Returned Two", {
        ownerType: "agent",
        ownerUserId: agent.userId,
      }),
    );
    await at(cairoToUtc(TODAY, "10:00"), () => deleteUser(agent.userId, me));

    const report = await dailyReportFor({ actorId: me.id!, companies: ALL, now: NOW });
    const today = dayOf(report, TODAY);
    expect(today.leadCount).toBe(2);
    expect(triggersOn(report, TODAY, one.id)).toEqual(["owner_deleted"]);
    expect(triggersOn(report, TODAY, two.id)).toEqual(["owner_deleted"]);
  });

  it("the money admin AFTER a win is deliberately outside the report", async () => {
    const me = await makeUser("Money Admin", ["bsystems_admin"]);
    const lead = await at(cairoToUtc(YESTERDAY, "08:00"), () => makeLead("bsystems", me, "Money Co"));
    await at(cairoToUtc(YESTERDAY, "09:00"), () =>
      move("bsystems", lead.id, "won", me, {
        group: "won_deal",
        data: {
          estimatedValue: 50_000,
          totalCommissionPercentBp: 1000,
          milestones: [{ label: "One", value: 50_000, commissionValue: 5_000 }],
        },
      }),
    );
    const milestone = await db.milestone.findFirstOrThrow({});
    const { checkMilestone } = await import("./milestones");
    await at(cairoToUtc(TODAY, "11:00"), () => checkMilestone(milestone.id, "bsystems", me));

    const report = await dailyReportFor({ actorId: me.id!, companies: ALL, now: NOW });
    /* the tick happened, and it logged — against the WON DEAL, not the lead */
    expect(
      await db.activityLog.count({ where: { action: "milestone_check", actorId: me.id } }),
    ).toBe(1);
    expect(dayOf(report, TODAY).leadCount).toBe(0);
    expect(dayOf(report, YESTERDAY).leadCount).toBe(1);
  });

  it("the partner/agent funnel never appears (ADR-061's exclusion, inherited)", async () => {
    const me = await makeUser("Partner Admin", ["bsystems_admin"]);
    const { createProspect } = await import("./partners");
    await at(cairoToUtc(TODAY, "10:00"), () =>
      createProspect({ kind: "partner", name: "Nile Prospect", number: "01099988877" }, me),
    );
    expect(
      await db.activityLog.count({ where: { entityType: "partner_prospect", actorId: me.id } }),
    ).toBeGreaterThan(0);

    const report = await dailyReportFor({ actorId: me.id!, companies: ALL, now: NOW });
    expect(report.days.map((d) => d.leadCount)).toEqual([0, 0, 0]);
  });
});

/* ------------------------------------------------------------------ the walls */

describe("THE ACTOR WALL — it is HIS report, 'not the admin, not anyone'", () => {
  it("a colleague's action on the SAME lead on the SAME day is absent, and not counted", async () => {
    const me = await makeUser("Viewer Admin", ["bsystems_admin"]);
    const colleague = await makeUser("Other Rep", ["bsystems_sales"]);
    const mine = await at(cairoToUtc(TODAY, "09:00"), () => makeLead("bsystems", me, "Shared Co"));
    const theirs = await at(cairoToUtc(TODAY, "09:30"), () =>
      makeLead("bsystems", colleague, "Their Own Co"),
    );
    /* the colleague acts on MY lead, in the window — the case that fails against
       a service with no actor predicate */
    await at(cairoToUtc(TODAY, "10:00"), () => setNoAnswer("bsystems", mine.id, true, colleague));
    await at(cairoToUtc(TODAY, "10:30"), () => markLeadWhatsappSent("bsystems", theirs.id, colleague));

    const report = await dailyReportFor({ actorId: me.id!, companies: ALL, now: NOW });
    const today = dayOf(report, TODAY);
    expect(today.leadCount).toBe(1);
    expect(today.leads[0]!.leadId).toBe(mine.id);
    expect(today.leads[0]!.interactions.map((i) => i.trigger)).toEqual(["create"]);
    expect(JSON.stringify(report)).not.toContain("Their Own Co");
    expect(JSON.stringify(report)).not.toContain("Other Rep");

    /* and the mirror: the colleague's report is HIS work only */
    const theirReport = await dailyReportFor({ actorId: colleague.id!, companies: ALL, now: NOW });
    expect(dayOf(theirReport, TODAY).leadCount).toBe(2); // his create + his action on mine
    expect(JSON.stringify(theirReport)).not.toContain("Viewer Admin");
  });

  it("an admin's report is HIS actions, never the team's — there is no admin-wide variant", async () => {
    const admin = await makeUser("The Founder", ["bsystems_admin"]);
    const agent = await makeUser("Field Agent", ["bsystems_agent"]);
    await at(cairoToUtc(TODAY, "09:00"), () =>
      makeLead("bsystems", agent, "Agent's Lead", {
        ownerType: "agent",
        ownerUserId: agent.userId,
      }),
    );
    const report = await dailyReportFor({ actorId: admin.id!, companies: ALL, now: NOW });
    expect(report.days.map((d) => d.leadCount)).toEqual([0, 0, 0]);
    expect(JSON.stringify(report)).not.toContain("Agent's Lead");
  });
});

describe("THE SCOPE WALL — never a lead he could not already open", () => {
  it("a lead reassigned AWAY from an agent is still counted, but redacted", async () => {
    const admin = await makeUser("Reassigning Admin", ["bsystems_admin"]);
    const agent = await makeUser("Losing Agent", ["bsystems_agent"]);
    const other = await makeUser("Gaining Agent", ["bsystems_agent"]);
    const lead = await at(cairoToUtc(TODAY, "09:00"), () =>
      makeLead("bsystems", agent, "Reassigned Co", {
        ownerType: "agent",
        ownerUserId: agent.userId,
      }),
    );
    await at(cairoToUtc(TODAY, "09:30"), () => setNoAnswer("bsystems", lead.id, true, agent));
    /* the admin hands it to somebody else — AFTER the agent's day */
    await assignLeadOwner(lead.id, other.userId, admin);

    const report = await dailyReportFor({
      actorId: agent.id!,
      companies: [{ brand: "bsystems", scope: { kind: "own", userId: agent.userId } }],
      now: NOW,
    });
    const today = dayOf(report, TODAY);
    expect(today.leadCount).toBe(1); // still his day — the number does not shrink
    const row = today.leads[0]!;
    expect(row.leadId).toBe(lead.id);
    expect(row.name).toBeNull();
    expect(row.href).toBeNull();
    expect(row.brand).toBeNull();
    expect(row.redacted).toBe("out_of_scope");
    expect(row.interactions.map((i) => i.trigger).sort()).toEqual(["create", "no_answer"]);
    expect(JSON.stringify(report)).not.toContain("Reassigned Co");
  });

  it("a sales rep's lead that left the INTERNAL bucket is redacted the same way", async () => {
    const admin = await makeUser("Bucket Admin", ["bsystems_admin"]);
    const sales = await makeUser("Internal Sales", ["bsystems_sales"]);
    const agent = await makeUser("Receiving Agent", ["bsystems_agent"]);
    const lead = await at(cairoToUtc(YESTERDAY, "09:00"), () =>
      makeLead("bsystems", sales, "Internal Then Agent Co"),
    );
    await assignLeadOwner(lead.id, agent.userId, admin); // ownerType becomes "agent"

    const report = await dailyReportFor({
      actorId: sales.id!,
      companies: [{ brand: "bsystems", scope: { kind: "internal" } }],
      now: NOW,
    });
    const row = dayOf(report, YESTERDAY).leads[0]!;
    expect(dayOf(report, YESTERDAY).leadCount).toBe(1);
    expect(row.redacted).toBe("out_of_scope");
    expect(row.name).toBeNull();
    expect(JSON.stringify(report)).not.toContain("Internal Then Agent Co");
  });

  it("a DELETED lead is counted, unlinked, and says it was deleted rather than refused", async () => {
    const me = await makeUser("Deleting Sales Admin", ["bsystems_admin"]);
    const lead = await at(cairoToUtc(TODAY, "09:00"), () => makeLead("bsystems", me, "Gone Co"));
    await at(cairoToUtc(TODAY, "10:00"), () => deleteLead("bsystems", lead.id, me));

    const report = await dailyReportFor({ actorId: me.id!, companies: ALL, now: NOW });
    const today = dayOf(report, TODAY);
    expect(today.leadCount).toBe(1);
    const row = today.leads[0]!;
    expect(row.redacted).toBe("deleted");
    expect(row.name).toBeNull();
    expect(row.href).toBeNull();
    expect(row.interactions.map((i) => i.trigger).sort()).toEqual(["create", "deleted"]);
    expect(JSON.stringify(report)).not.toContain("Gone Co");
  });

  it("an ARCHIVED lead stays a real, linked row — archiving is not a refusal", async () => {
    const me = await makeUser("Archiving Admin", ["bsystems_admin"]);
    const lead = await at(cairoToUtc(TODAY, "09:00"), () => makeLead("bsystems", me, "Archived Co"));
    await at(cairoToUtc(TODAY, "10:00"), () => setArchived("bsystems", lead.id, true, me));

    const row = dayOf(
      await dailyReportFor({ actorId: me.id!, companies: ALL, now: NOW }),
      TODAY,
    ).leads[0]!;
    expect(row.name).toBe("Archived Co");
    expect(row.archived).toBe(true);
    expect(row.redacted).toBeNull();
    expect(row.href).toBe(`/b-systems/crm/lead/${lead.id}?company=bsystems`);
  });

  it("a company the account does NOT hold contributes nothing", async () => {
    const me = await makeUser("Dual Hands", ["bsystems_admin", "byteforce_staff"]);
    const bs = await at(cairoToUtc(TODAY, "09:00"), () => makeLead("bsystems", me, "BS Only Co"));
    const bf = await at(cairoToUtc(TODAY, "09:30"), () => makeLead("byteforce", me, "BF Only Co"));

    const bsOnly = await dailyReportFor({
      actorId: me.id!,
      companies: [{ brand: "bsystems", scope: { kind: "all" } }],
      now: NOW,
    });
    const today = dayOf(bsOnly, TODAY);
    /* the ByteForce lead is still HIS action, so it still counts — it is simply
       redacted, exactly like any other lead he cannot open today */
    expect(today.leadCount).toBe(2);
    expect(today.leads.find((l) => l.leadId === bs.id)!.name).toBe("BS Only Co");
    expect(today.leads.find((l) => l.leadId === bf.id)!.name).toBeNull();
    expect(JSON.stringify(bsOnly)).not.toContain("BF Only Co");
  });
});

/* ----------------------------------------------------------- cross-company */

describe("CROSS-COMPANY — it is a report about a PERSON'S DAY (ADR-071's precedent)", () => {
  it("both companies' leads sit on one day, with one headline count and each row's own company", async () => {
    const me = await makeUser("Both Companies", ["bsystems_admin", "byteforce_staff"]);
    const bs = await at(cairoToUtc(TODAY, "09:00"), () => makeLead("bsystems", me, "Dual BS Co"));
    const bf = await at(cairoToUtc(TODAY, "10:00"), () => makeLead("byteforce", me, "Dual BF Co"));

    const report = await dailyReportFor({ actorId: me.id!, companies: ALL, now: NOW });
    const today = dayOf(report, TODAY);
    expect(today.leadCount).toBe(2);
    const byId = new Map(today.leads.map((l) => [l.leadId, l]));
    expect(byId.get(bs.id)!.brand).toBe("bsystems");
    expect(byId.get(bf.id)!.brand).toBe("byteforce");
    /* the hrefs came from leadHref — two DIFFERENT screens, each carrying its
       own company, which is the bug ADR-074's table exists to prevent */
    expect(byId.get(bs.id)!.href).toBe(`/b-systems/crm/lead/${bs.id}?company=bsystems`);
    expect(byId.get(bf.id)!.href).toBe(`/b-systems/leads/lead/${bf.id}?company=byteforce`);
  });

  it("a REDACTED row keeps its place in the day — redaction changes what it says, not where it is", async () => {
    /* a row with no company to sort by is ordered as if it belonged to the
       company being looked at. The alternative pushed every deleted or
       reassigned lead to the bottom of the day however recently it was worked,
       which reads as if the report had lost track of it. */
    const me = await makeUser("Ordering Admin", ["bsystems_admin", "byteforce_staff"]);
    await at(cairoToUtc(TODAY, "09:00"), () => makeLead("bsystems", me, "Order Kept Co"));
    const doomed = await at(cairoToUtc(TODAY, "10:00"), () =>
      makeLead("bsystems", me, "Order Doomed Co"),
    );
    await at(cairoToUtc(TODAY, "11:00"), () => deleteLead("bsystems", doomed.id, me));

    for (const primary of ["bsystems", "byteforce"] as const) {
      const today = dayOf(
        await dailyReportFor({ actorId: me.id!, companies: ALL, primary, now: NOW }),
        TODAY,
      );
      expect(today.leadCount).toBe(2);
      /* the deleted lead was touched most recently, so it is FIRST — under either
         company label, because its own company can no longer be named */
      expect(today.leads[0]!.leadId).toBe(doomed.id);
      expect(today.leads[0]!.redacted).toBe("deleted");
      expect(today.leads[1]!.name).toBe("Order Kept Co");
    }
  });

  it("the company switched to orders the day — it never filters it", async () => {
    const me = await makeUser("Ordering Founder", ["bsystems_admin", "byteforce_staff"]);
    /* the BS lead is the more recent one, so ordering by time alone would put it
       first under either label */
    await at(cairoToUtc(TODAY, "09:00"), () => makeLead("byteforce", me, "Order BF Co"));
    await at(cairoToUtc(TODAY, "10:00"), () => makeLead("bsystems", me, "Order BS Co"));

    const underBs = await dailyReportFor({
      actorId: me.id!,
      companies: ALL,
      primary: "bsystems",
      now: NOW,
    });
    const underBf = await dailyReportFor({
      actorId: me.id!,
      companies: ALL,
      primary: "byteforce",
      now: NOW,
    });
    expect(dayOf(underBs, TODAY).leads.map((l) => l.name)).toEqual(["Order BS Co", "Order BF Co"]);
    expect(dayOf(underBf, TODAY).leads.map((l) => l.name)).toEqual(["Order BF Co", "Order BS Co"]);
    /* same content, same count, both ways — the switch is not a filter */
    expect(dayOf(underBs, TODAY).leadCount).toBe(2);
    expect(dayOf(underBf, TODAY).leadCount).toBe(2);
  });
});

/* ------------------------------------------------------------------ the days */

describe("CAIRO DAYS, including Egypt's two transition days", () => {
  it("late-evening Cairo work belongs to its CAIRO day, not to UTC's", async () => {
    const me = await makeUser("Late Admin", ["bsystems_admin"]);
    /* 23:30 Cairo on the 25th is 20:30Z on the 25th — the same UTC date, but the
       case that matters is the boundary itself: 00:30 Cairo on the 26th is
       21:30Z on the 25th, i.e. YESTERDAY in UTC and TODAY in Cairo */
    const late = await at(cairoToUtc(YESTERDAY, "23:30"), () =>
      makeLead("bsystems", me, "Late Yesterday Co"),
    );
    const early = await at(cairoToUtc(TODAY, "00:30"), () =>
      makeLead("bsystems", me, "Early Today Co"),
    );

    const report = await dailyReportFor({ actorId: me.id!, companies: ALL, now: NOW });
    expect(dayOf(report, YESTERDAY).leads.map((l) => l.leadId)).toEqual([late.id]);
    expect(dayOf(report, TODAY).leads.map((l) => l.leadId)).toEqual([early.id]);
  });

  it("SPRING FORWARD (2026-04-24, whose midnight does not exist)", async () => {
    const me = await makeUser("Spring Admin", ["bsystems_admin"]);
    const eve = await at(cairoToUtc("2026-04-23", "23:30"), () =>
      makeLead("bsystems", me, "Spring Eve Co"),
    );
    const day = await at(cairoToUtc("2026-04-24", "01:30"), () =>
      makeLead("bsystems", me, "Spring Day Co"),
    );
    const oldest = await at(cairoToUtc("2026-04-22", "12:00"), () =>
      makeLead("bsystems", me, "Spring Oldest Co"),
    );

    const report = await dailyReportFor({
      actorId: me.id!,
      companies: ALL,
      now: cairoToUtc("2026-04-24", "12:00"),
    });
    expect(report.days.map((d) => d.date)).toEqual(["2026-04-24", "2026-04-23", "2026-04-22"]);
    expect(dayOf(report, "2026-04-23").leads.map((l) => l.leadId)).toEqual([eve.id]);
    expect(dayOf(report, "2026-04-24").leads.map((l) => l.leadId)).toEqual([day.id]);
    expect(dayOf(report, "2026-04-22").leads.map((l) => l.leadId)).toEqual([oldest.id]);
  });

  it("AUTUMN FOLD (2026-10-29, the 25-hour day): both 23:30s land on it", async () => {
    const me = await makeUser("Autumn Admin", ["bsystems_admin"]);
    /* THE REPEATED HOUR ITSELF. Egypt leaves DST at 21:00Z — 00:00 on the 30th
       EEST becomes 23:00 on the 29th EET — so 2026-10-29 23:30 Cairo happens
       TWICE, at 20:30Z (EEST) and again at 21:30Z (EET), and the pair below is
       exactly that pair. The first draft used 19:30Z/20:30Z, which are 22:30 and
       23:30 and never cross the fold at all: it asserted the same thing the
       late-evening case above does. Review, Run 097. */
    const first = await at(new Date("2026-10-29T20:30:00Z"), () =>
      makeLead("bsystems", me, "Fold First Co"),
    );
    const second = await at(new Date("2026-10-29T21:30:00Z"), () =>
      makeLead("bsystems", me, "Fold Second Co"),
    );

    const report = await dailyReportFor({
      actorId: me.id!,
      companies: ALL,
      now: cairoToUtc("2026-10-30", "12:00"),
    });
    expect(report.days.map((d) => d.date)).toEqual(["2026-10-30", "2026-10-29", "2026-10-28"]);
    const fold = dayOf(report, "2026-10-29");
    expect(fold.leadCount).toBe(2);
    expect(fold.leads.map((l) => l.leadId).sort()).toEqual([first.id, second.id].sort());
  });
});

/* ------------------------------------------------------------- impersonation */

describe("IMPERSONATION attributes to the impersonated user, and says so", () => {
  it("an admin acting as Omar fills OMAR's report, with the (via …) visible on the line", async () => {
    const omar = await makeUser("Omar Agent", ["bsystems_agent"]);
    const admin = await makeUser("Elmur", ["bsystems_admin"]);
    const lead = await at(cairoToUtc(TODAY, "09:00"), () =>
      makeLead("bsystems", omar, "Omar's Lead", {
        ownerType: "agent",
        ownerUserId: omar.userId,
      }),
    );
    await at(cairoToUtc(TODAY, "10:00"), () =>
      addLeadComment({
        leadId: lead.id,
        body: "called on his behalf",
        author: { id: omar.userId, name: omar.label },
        via: admin.label,
      }),
    );

    const omarsDay = dayOf(
      await dailyReportFor({
        actorId: omar.id!,
        companies: [{ brand: "bsystems", scope: { kind: "own", userId: omar.userId } }],
        now: NOW,
      }),
      TODAY,
    );
    expect(omarsDay.leadCount).toBe(1);
    const comment = omarsDay.leads[0]!.interactions.find((i) => i.trigger === "lead_chat")!;
    expect(comment.actorLabel).toBe("Omar Agent (via Elmur)");

    /* and it is NOT in the admin's own report */
    const adminsDay = dayOf(
      await dailyReportFor({ actorId: admin.id!, companies: ALL, now: NOW }),
      TODAY,
    );
    expect(adminsDay.leadCount).toBe(0);
  });

  /* WHAT THE MARKER REALLY COVERS. Review, Run 097: the screen used to name the
     actor whenever the stored label differed from the reader's CURRENT name, which
     is not the same question. `actorLabel` is history and a rename is allowed, so
     that predicate printed a person's OWN old name in the slot reserved for
     somebody else's work. The label is shown only when it is a via-label — which
     in this product means the lead chat, the one writer that records an
     impersonator. */
  it("a stage move made while impersonating is stamped with the IMPERSONATED name alone", async () => {
    const omar = await makeUser("Omar Two", ["bsystems_agent"]);
    const lead = await at(cairoToUtc(TODAY, "09:00"), () =>
      makeLead("bsystems", omar, "Omar's Second Lead", {
        ownerType: "agent",
        ownerUserId: omar.userId,
      }),
    );
    /* the actor every non-chat lead writer builds: `{ id: user.id, label: user.name }`,
       and under impersonation `user` IS the impersonated person (guards.ts) */
    await at(cairoToUtc(TODAY, "10:00"), () =>
      move("bsystems", lead.id, "following_up", omar, followUp(TODAY), "bsystems_agent"),
    );

    const day = dayOf(
      await dailyReportFor({
        actorId: omar.id!,
        companies: [{ brand: "bsystems", scope: { kind: "own", userId: omar.userId } }],
        now: NOW,
      }),
      TODAY,
    );
    for (const i of day.leads[0]!.interactions) {
      expect(i.actorLabel).toBe("Omar Two");
      /* so the row carries NO marker — the report must not imply it can tell */
      expect(isViaLabel(i.actorLabel)).toBe(false);
    }
  });

  it("isViaLabel names an impersonation label and nothing else", () => {
    expect(isViaLabel("Omar Agent (via Elmur)")).toBe(true);
    expect(isViaLabel("Omar Agent (via Elmur) ")).toBe(true);
    expect(isViaLabel("Omar Agent")).toBe(false);
    /* the rename false positive this predicate exists to refuse */
    expect(isViaLabel("Omar's Old Name")).toBe(false);
    expect(isViaLabel("Seed")).toBe(false);
    expect(isViaLabel("(via )")).toBe(false);
  });
});

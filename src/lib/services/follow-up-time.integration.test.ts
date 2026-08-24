import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { cairoToUtc, utcToCairo } from "@/lib/datetime";
import { applyLeadEvent, createLead } from "./leads";
import { backfillFollowUpDueTimeSet } from "./backup";
import { todoFor } from "./todo";
import type { Actor } from "./activity";

/* ADR-063 (founder: "let's get the time back for the follow up but it's not
   mandtory") — the marker, end to end.

   `FollowUp.dueAt` is ONE UTC instant, so a blank submission and a deliberate
   09:00 are the same instant. `dueTimeSet` is the only thing that tells them
   apart, and it is written from the WIRE: true exactly when a time arrived.
   Fixed Cairo instants throughout — these pins hold on a machine in any
   timezone. */

const MIGRATION_SQL = path.resolve(
  __dirname,
  "../../../prisma/migrations/20260825093000_follow_up_due_time_set/migration.sql",
);

let seq = 0;
async function makeActor(): Promise<Actor> {
  const user = await db.user.create({
    data: { name: "Follow-up Time Tester", phone: `+2010999000${seq++}`, passwordHash: "x" },
  });
  return { id: user.id, label: user.name };
}

async function leadWithFollowUp(
  actor: Actor,
  name: string,
  data: { date: string; time?: string; method: "call" },
) {
  const lead = await createLead(
    "bsystems",
    { name, number: "0101234567", type: "cold_call", companyName: `${name} Co` },
    actor,
  );
  await applyLeadEvent({
    brand: "bsystems",
    leadId: lead.id,
    event: { type: "next_action", action: "following_up" },
    group: { group: "follow_up", data } as never,
    actor,
    role: "bsystems_admin",
  });
  const row = await db.followUp.findFirstOrThrow({ where: { leadId: lead.id } });
  return { lead, row };
}

beforeEach(async () => {
  await resetDb();
});

describe("ADR-063 — a chosen time is recorded as chosen", () => {
  it("posted WITH a time: the instant is the posted slot and the row reads back as time-set", async () => {
    const actor = await makeActor();
    const { row } = await leadWithFollowUp(actor, "Chose 16:45", {
      date: "2026-08-20",
      time: "16:45",
      method: "call",
    });
    expect(utcToCairo(row.dueAt)).toEqual({ date: "2026-08-20", time: "16:45" });
    expect(row.dueTimeSet).toBe(true);
  });

  it("posted WITHOUT a time: the ADR-061 09:00 Cairo default, and the row reads back as date-only", async () => {
    const actor = await makeActor();
    const { row } = await leadWithFollowUp(actor, "Day Only", {
      date: "2026-08-20",
      method: "call",
    });
    expect(utcToCairo(row.dueAt)).toEqual({ date: "2026-08-20", time: "09:00" });
    expect(row.dueTimeSet).toBe(false);
  });

  it("a DELIBERATE 09:00 is time-set even though its instant equals the default", async () => {
    /* the whole reason the marker exists: no instant can express this */
    const actor = await makeActor();
    const { row } = await leadWithFollowUp(actor, "Chose 09:00", {
      date: "2026-08-20",
      time: "09:00",
      method: "call",
    });
    expect(utcToCairo(row.dueAt)).toEqual({ date: "2026-08-20", time: "09:00" });
    expect(row.dueTimeSet).toBe(true);
  });
});

describe("ADR-063 — the migration's backfill rule, run as shipped", () => {
  /* The SQL under test is READ FROM THE MIGRATION FILE, so this test cannot
     drift from what actually ships. */
  const backfillSql = () => {
    const sql = readFileSync(MIGRATION_SQL, "utf8");
    const update = sql.match(/UPDATE "FollowUp"[\s\S]*?;/);
    if (!update) throw new Error("the ADR-063 migration no longer contains its backfill UPDATE");
    return update[0];
  };

  it("classifies a pre-existing 14:30 row as time-set and a 09:00 row as date-only — and again on a re-run", async () => {
    const actor = await makeActor();
    const lead = await createLead(
      "bsystems",
      { name: "Legacy Corp", number: "0101112223", type: "cold_call" },
      actor,
    );
    /* the legacy state: rows written before the column existed, i.e. false */
    const chosen = await db.followUp.create({
      data: {
        leadId: lead.id,
        context: "initial",
        dueAt: cairoToUtc("2026-08-20", "14:30"),
        method: "call",
      },
    });
    const defaulted = await db.followUp.create({
      data: {
        leadId: lead.id,
        context: "initial",
        dueAt: cairoToUtc("2026-08-20", "09:00"),
        method: "call",
      },
    });
    /* winter, the other side of Egypt's DST — the rule is a CAIRO wall clock,
       never a fixed UTC offset */
    const winterDefault = await db.followUp.create({
      data: {
        leadId: lead.id,
        context: "initial",
        dueAt: cairoToUtc("2026-01-15", "09:00"),
        method: "call",
      },
    });
    expect([chosen, defaulted, winterDefault].map((r) => r.dueTimeSet)).toEqual([
      false,
      false,
      false,
    ]);

    const marked = await db.$executeRawUnsafe(backfillSql());
    expect(marked).toBe(1); // only the 14:30 row

    const read = async (id: string) =>
      (await db.followUp.findUniqueOrThrow({ where: { id } })).dueTimeSet;
    expect(await read(chosen.id)).toBe(true);
    expect(await read(defaulted.id)).toBe(false);
    expect(await read(winterDefault.id)).toBe(false);

    /* idempotent: a second pass has nothing left to match */
    expect(await db.$executeRawUnsafe(backfillSql())).toBe(0);
    expect(await read(chosen.id)).toBe(true);
    expect(await read(defaulted.id)).toBe(false);
    expect(await read(winterDefault.id)).toBe(false);
  });

  /* The restore path re-inserts a PRE-marker export onto a migrated database,
     where the migration can never run again — so backup.ts carries a twin.
     House pattern (normaliseProspectStages): run both against IDENTICAL
     fixtures and diff the result. */
  it("the importBackup twin classifies exactly like the shipped migration SQL", async () => {
    const fixtures: Array<[string, string, string]> = [
      ["Chosen afternoon", "2026-08-20", "14:30"],
      ["Default summer", "2026-08-20", "09:00"],
      ["Default winter", "2026-01-15", "09:00"],
      ["One minute off", "2026-01-15", "09:01"],
      ["Late evening", "2026-08-20", "23:30"],
      ["Just past midnight", "2026-08-20", "00:15"],
    ];
    const plantAndRun = async (run: () => Promise<unknown>) => {
      await resetDb();
      const actor = await makeActor();
      const lead = await createLead(
        "bsystems",
        { name: "Parity Corp", number: "0101112225", type: "cold_call" },
        actor,
      );
      for (const [name, date, time] of fixtures) {
        await db.followUp.create({
          data: {
            leadId: lead.id,
            context: "initial",
            dueAt: cairoToUtc(date, time),
            method: "call",
            followingUpWith: name,
          },
        });
      }
      await run();
      const rows = await db.followUp.findMany({ orderBy: { followingUpWith: "asc" } });
      return rows.map((r) => `${r.followingUpWith}=${r.dueTimeSet}`);
    };

    const viaMigration = await plantAndRun(() => db.$executeRawUnsafe(backfillSql()));
    const viaRestore = await plantAndRun(() =>
      db.$transaction((tx) => backfillFollowUpDueTimeSet(tx)),
    );
    expect(viaRestore).toEqual(viaMigration);
    expect(viaMigration).toEqual([
      "Chosen afternoon=true",
      "Default summer=false",
      "Default winter=false",
      "Just past midnight=true",
      "Late evening=true",
      "One minute off=true",
    ]);
  });

  it("never touches a row that is already time-set", async () => {
    const actor = await makeActor();
    const lead = await createLead(
      "bsystems",
      { name: "Already Marked", number: "0101112224", type: "cold_call" },
      actor,
    );
    const row = await db.followUp.create({
      data: {
        leadId: lead.id,
        context: "initial",
        dueAt: cairoToUtc("2026-08-20", "09:00"),
        method: "call",
        dueTimeSet: true, // a deliberate 09:00 recorded after ADR-063
      },
    });
    expect(await db.$executeRawUnsafe(backfillSql())).toBe(0);
    expect((await db.followUp.findUniqueOrThrow({ where: { id: row.id } })).dueTimeSet).toBe(true);
  });
});

describe("ADR-063 — the To-Do clock is per row, not a constant", () => {
  it("shows the time only on the follow-up whose time was chosen; a meeting keeps its own", async () => {
    const actor = await makeActor();
    await leadWithFollowUp(actor, "Chose A Time", {
      date: "2026-08-20",
      time: "16:45",
      method: "call",
    });
    const { lead: dayOnlyLead } = await leadWithFollowUp(actor, "Left It Blank", {
      date: "2026-08-20",
      method: "call",
    });
    /* a meeting on a third lead — its clock is unconditional (ADR-061) */
    const meetingLead = await createLead(
      "bsystems",
      { name: "Has A Meeting", number: "0101112226", type: "cold_call" },
      actor,
    );
    await applyLeadEvent({
      brand: "bsystems",
      leadId: meetingLead.id,
      event: { type: "next_action", action: "meeting_setting" },
      group: {
        group: "meeting",
        data: { arranged: true, date: "2026-08-20", time: "11:00", mode: "online" },
      } as never,
      actor,
      role: "bsystems_admin",
    });

    const lists = await todoFor({
      brand: "bsystems",
      scope: { kind: "all" },
      now: cairoToUtc("2026-08-20", "12:00"),
    });
    const byTitle = new Map(lists.today.map((i) => [i.title, i]));
    expect(byTitle.get("Chose A Time")).toMatchObject({ kind: "follow_up", withTime: true });
    expect(byTitle.get("Left It Blank")).toMatchObject({ kind: "follow_up", withTime: false });
    expect(byTitle.get("Has A Meeting")).toMatchObject({ kind: "meeting", withTime: true });

    /* and the blank one really is the 09:00 default underneath — the row hides
       a clock it HAS, which is the entire ADR-063 design */
    const blank = await db.followUp.findFirstOrThrow({ where: { leadId: dayOnlyLead.id } });
    expect(utcToCairo(blank.dueAt).time).toBe("09:00");
  });
});

describe("ADR-063 — a time never moves a follow-up off its Cairo day", () => {
  it("23:30 belongs to its own day: it is TODAY at midday and gone the next morning", async () => {
    const actor = await makeActor();
    const { row } = await leadWithFollowUp(actor, "Late Evening", {
      date: "2026-08-20",
      time: "23:30",
      method: "call",
    });
    expect(utcToCairo(row.dueAt)).toEqual({ date: "2026-08-20", time: "23:30" });
    expect(row.dueTimeSet).toBe(true);

    const midday = await todoFor({
      brand: "bsystems",
      scope: { kind: "all" },
      now: cairoToUtc("2026-08-20", "12:00"),
    });
    expect(midday.today.map((i) => i.title)).toContain("Late Evening");

    /* 00:30 Cairo the NEXT day is a different Cairo day — and ADR-061 left no
       overdue list, so the row is simply gone rather than merely re-bucketed */
    const nextMorning = await todoFor({
      brand: "bsystems",
      scope: { kind: "all" },
      now: cairoToUtc("2026-08-21", "00:30"),
    });
    expect(nextMorning.today.map((i) => i.title)).not.toContain("Late Evening");
  });

  it("00:30 on Egypt's spring-forward day stays on its posted day, and counts as chosen", async () => {
    /* the ADR-061 DST re-anchor, now with the marker: the wall-clock 00:30 does
       not exist on 2026-04-24, so the instant lands at 01:30 — still the posted
       day, and still a time the user chose. */
    const actor = await makeActor();
    const { row } = await leadWithFollowUp(actor, "Spring Forward", {
      date: "2026-04-24",
      time: "00:30",
      method: "call",
    });
    expect(utcToCairo(row.dueAt)).toEqual({ date: "2026-04-24", time: "01:30" });
    expect(row.dueTimeSet).toBe(true);

    const lists = await todoFor({
      brand: "bsystems",
      scope: { kind: "all" },
      now: cairoToUtc("2026-04-24", "12:00"),
    });
    expect(lists.today.map((i) => i.title)).toContain("Spring Forward");
  });
});

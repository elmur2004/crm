import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { applyLeadEvent, createLead, setNoAnswer } from "./leads";
import { pendingUndoFor, performUndo } from "./undo";
import { cairoToUtc, nextCairoDate, utcToCairo } from "@/lib/datetime";
import { todoFor } from "./todo";
import { dailyReportFor } from "./daily-report";
import type { Actor } from "./activity";

/* ============================================================================
   ADR-082 — "Didn't answer" LOGS TOMORROW'S FOLLOW-UP BY ITSELF.

   The founder, verbatim: "whenever I log didn't answer for someone who's in the
   following up column in the day of the follow up it automatically logs another
   follow up until he answers."

   And, asked what should happen to a lead that is already behind: "no keep it
   fallen behind in a separate column I will pick it up and make another follow
   up date."

   SO THERE ARE FOUR THINGS TO PROVE, AND THREE OF THEM ARE NEGATIVE:

     1. due TODAY        -> a second follow-up appears, dated TOMORROW
     2. due in the FUTURE-> nothing is written (he has not chased it yet, and
                            moving the date would rewrite his own commitment)
     3. already BEHIND   -> nothing is written (his explicit instruction)
     4. another STAGE    -> nothing is written

   Plus the two properties that make it safe to leave on:
     · UNDO takes the auto-logged row with it (the phantom follow-up is the
       trap: an undo that left it behind would silently re-enter the lead into
       tomorrow's list), and
     · the downstream projections stay honest — the To-Do, the board's datum
       and the daily report's DISTINCT-LEAD count.

   `now` is injected throughout so the Cairo day is named rather than inferred:
   these pins hold on a machine in any timezone, on any date, for ever.
   ========================================================================== */

/* A fixed, ordinary Cairo day — no DST transition anywhere near it. The
   transition days get their own case at the bottom. */
const TODAY = "2026-11-10";
const TOMORROW = "2026-11-11";
const AT_NOON = cairoToUtc(TODAY, "12:00");

let seq = 0;
async function makeActor(name = "Auto Follow-up Tester"): Promise<Actor> {
  const user = await db.user.create({
    data: { name, phone: `+2010777200${seq++}`, passwordHash: "x" },
  });
  return { id: user.id, label: user.name };
}

const admin: Actor = { id: null, label: "Test Admin" };

async function leadDueOn(
  date: string,
  opts: { actor?: Actor; method?: "call" | "message" | "visit"; about?: string; time?: string } = {},
) {
  seq += 1;
  const actor = opts.actor ?? admin;
  const lead = await createLead(
    "bsystems",
    {
      name: `Chase Co ${seq}`,
      number: `010777${String(3000 + seq)}`,
      type: "cold_call",
      companyName: `Chase ${seq}`,
    },
    actor,
  );
  await applyLeadEvent({
    brand: "bsystems",
    leadId: lead.id,
    event: { type: "next_action", action: "following_up" },
    group: {
      group: "follow_up",
      data: {
        date,
        method: opts.method ?? "call",
        ...(opts.time ? { time: opts.time } : {}),
        ...(opts.about ? { followingUpWith: opts.about } : {}),
      },
    } as never,
    actor,
    role: "bsystems_admin",
  });
  return lead;
}

const followUps = (leadId: string) =>
  db.followUp.findMany({ where: { leadId }, orderBy: { createdAt: "asc" } });

beforeEach(async () => {
  await resetDb();
});

describe("1. due TODAY — the press logs tomorrow's follow-up", () => {
  it("writes a SECOND follow-up dated tomorrow, date-only, and never moves the card", async () => {
    const lead = await leadDueOn(TODAY);
    await setNoAnswer("bsystems", lead.id, true, admin, AT_NOON);

    const rows = await followUps(lead.id);
    expect(rows).toHaveLength(2);
    const next = rows[1]!;
    expect(utcToCairo(next.dueAt).date).toBe(TOMORROW);
    /* ADR-061/063 — the SYSTEM chose the day, so nobody chose a clock: the
       marker is false and the slot is the 09:00 Cairo default, which is what
       makes every screen print a bare date rather than a 9:00 AM he never set */
    expect(next.dueTimeSet).toBe(false);
    expect(utcToCairo(next.dueAt).time).toBe("09:00");

    /* the marker still counted, and the card still has not moved */
    const row = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(row.stage).toBe("following_up");
    expect(row.noAnswerCount).toBe(1);
    expect(row.noAnswer).toBe(true);
  });

  it("INHERITS the chase's method, its about-text, its owner and its context", async () => {
    /* It is the SAME conversation on a later day. A row that forgot the method
       and the subject would read as a new unrelated task. */
    const rep = await db.salesRep.create({ data: { brand: "bsystems", name: "Inherit Rep" } });
    const lead = await createLead(
      "bsystems",
      { name: "Inherit Co", number: "0107773999", type: "cold_call", companyName: "Inherit" },
      admin,
    );
    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "following_up" },
      group: {
        group: "follow_up",
        data: {
          date: TODAY,
          time: "16:45", // a clock HE chose — and it must not be inherited
          method: "message",
          followingUpWith: "The revised proposal price",
          ownerSalesRepId: rep.id,
        },
      } as never,
      actor: admin,
      role: "bsystems_admin",
    });

    await setNoAnswer("bsystems", lead.id, true, admin, AT_NOON);
    const rows = await followUps(lead.id);
    expect(rows).toHaveLength(2);
    const [live, next] = rows as [(typeof rows)[number], (typeof rows)[number]];
    expect(next.method).toBe("message");
    expect(next.followingUpWith).toBe("The revised proposal price");
    expect(next.ownerSalesRepId).toBe(rep.id);
    expect(next.context).toBe(live.context);
    /* the TIME is the one thing NOT inherited: his 16:45 was a choice about
       today's call, not a standing appointment */
    expect(live.dueTimeSet).toBe(true);
    expect(next.dueTimeSet).toBe(false);
  });

  it("carries the CONTEXT, so an after-proposal chase keeps its title", async () => {
    /* The lead reached Following Up through T-5 (proposal sent), so its
       follow-up context is `after_proposal` and the record is titled "Following
       up after proposal". The auto-logged chase is still about that proposal. */
    const lead = await createLead(
      "bsystems",
      { name: "Context Co", number: "0107773998", type: "cold_call", companyName: "Context" },
      admin,
    );
    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "sending_proposal" },
      group: { group: "proposal", data: { service: "Website", sent: false } } as never,
      actor: admin,
      role: "bsystems_admin",
    });
    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "proposal_sent" },
      group: { group: "follow_up", data: { date: TODAY, method: "call" } } as never,
      actor: admin,
      role: "bsystems_admin",
    });
    const before = await followUps(lead.id);
    expect(before.at(-1)!.context).toBe("after_proposal");

    await setNoAnswer("bsystems", lead.id, true, admin, AT_NOON);
    const after = await followUps(lead.id);
    expect(after.at(-1)!.context).toBe("after_proposal");
  });

  it("REPEATS across days — press today, press again tomorrow, and the chase walks forward", async () => {
    /* "it automatically logs another follow up until he answers." */
    const lead = await leadDueOn(TODAY);
    await setNoAnswer("bsystems", lead.id, true, admin, AT_NOON);
    const day2 = nextCairoDate(TODAY);
    await setNoAnswer("bsystems", lead.id, true, admin, cairoToUtc(day2, "12:00"));
    const day3 = nextCairoDate(day2);
    await setNoAnswer("bsystems", lead.id, true, admin, cairoToUtc(day3, "12:00"));

    const rows = await followUps(lead.id);
    expect(rows.map((r) => utcToCairo(r.dueAt).date)).toEqual([
      TODAY,
      day2,
      day3,
      nextCairoDate(day3),
    ]);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).noAnswerCount).toBe(3);
  });

  it("CANNOT PILE UP — a second press the same day only counts", async () => {
    /* The gate closes by itself: after the first press the live follow-up is
       dated TOMORROW, so today's date no longer matches. This is also what
       makes concurrency safe (the tally update takes the lead's row lock before
       the live follow-up is read). */
    const lead = await leadDueOn(TODAY);
    await setNoAnswer("bsystems", lead.id, true, admin, AT_NOON);
    await setNoAnswer("bsystems", lead.id, true, admin, cairoToUtc(TODAY, "15:00"));
    await setNoAnswer("bsystems", lead.id, true, admin, cairoToUtc(TODAY, "18:00"));

    expect(await followUps(lead.id)).toHaveLength(2);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).noAnswerCount).toBe(3);
  });

  it("THE GATE READS THE LOCKED ROW — a press racing a move OUT books nothing", async () => {
    /* Review finding. The three conditions were read from two different rows:
       the follow-up from inside the transaction, under the lock, but the STAGE
       from the `getLead` snapshot taken before the transaction existed. A press
       racing a move to Meeting Setting therefore booked tomorrow's chase for a
       lead that had already left the column the founder named ("someone who's
       in the following up column").

       The ordering is NAMED here rather than hoped for, with two real
       overlapping Postgres transactions:
         T1  moves the lead to Meeting Setting and HOLDS the row lock;
         the press starts, and its pre-transaction read still sees
         `following_up` (READ COMMITTED — T1 has not committed), then blocks on
         the lock at its own update;
         T1 commits, the press's update returns the row as it NOW is, and the
         gate must believe THAT row.
       Deterministic: no retry, no flake, and it goes red the moment the gate
       reads the snapshot again. */
    const lead = await leadDueOn(TODAY);
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const mover = db.$transaction(
      async (tx) => {
        await tx.lead.update({ where: { id: lead.id }, data: { stage: "meeting_setting" } });
        await held;
      },
      { timeout: 20_000 },
    );
    await new Promise((r) => setTimeout(r, 400)); // T1 now holds the lock
    const press = setNoAnswer("bsystems", lead.id, true, admin, AT_NOON);
    await new Promise((r) => setTimeout(r, 400)); // the press is blocked on it
    release();
    await mover;
    await press;

    /* NO second follow-up, and nothing in the log claiming one was written */
    expect(await followUps(lead.id)).toHaveLength(1);
    expect(await db.activityLog.count({ where: { entityId: lead.id, trigger: "FU-AUTO" } })).toBe(
      0,
    );
    /* the ATTEMPT still counted — the stage decides the follow-up, not the tally */
    const row = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(row.stage).toBe("meeting_setting");
    expect(row.noAnswerCount).toBe(1);
  });

  it("TOMORROW IS NEVER DOUBLE-BOOKED — the press flags, counts, and adds no row", async () => {
    /* Review finding, and it needs no race at all: book tomorrow BY HAND, then
       log a chase for today. The live follow-up is the NEWEST row — today's —
       so the gate opens, and the day it would book is already taken.

       The second row is the defect because the To-Do derives "done" per CAIRO
       DAY: any same-day follow-up that is not the live record reads as
       "superseded". The lead would appear on tomorrow's list as live work AND
       in the same day's Done section — one card, twice, contradicting itself.

       WHAT THE PRESS DOES INSTEAD: it still flags and still counts (the attempt
       really happened, and the tally is his own "so we can know how many times
       we tried"); it writes no row and no FU-AUTO line, because nothing was
       logged. His sentence — "it automatically logs another follow up until he
       answers" — is already satisfied when tomorrow is booked. */
    const lead = await leadDueOn(TOMORROW);
    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "follow_up_again" },
      group: { group: "follow_up", data: { date: TODAY, method: "call" } } as never,
      actor: admin,
      role: "bsystems_admin",
    });
    expect(await followUps(lead.id)).toHaveLength(2);

    await setNoAnswer("bsystems", lead.id, true, admin, AT_NOON);

    const rows = await followUps(lead.id);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => utcToCairo(r.dueAt).date).sort()).toEqual([TODAY, TOMORROW]);
    const row = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(row.noAnswerCount).toBe(1);
    expect(row.noAnswer).toBe(true);
    expect(await db.activityLog.count({ where: { entityId: lead.id, trigger: "FU-AUTO" } })).toBe(
      0,
    );
    /* and the press is still UNDOABLE — it just has no created row to carry */
    expect(await db.activityLog.count({ where: { entityId: lead.id, trigger: "no_answer" } })).toBe(
      1,
    );
  });

  it("…so tomorrow's To-Do carries that lead ONCE, never as live work AND done", async () => {
    /* The consequence the duplicate produced, asserted where he would have seen
       it. With TWO rows on tomorrow, the newer one is tomorrow's live task and
       the older one lands in the SAME day's Done section as "superseded" — the
       lead printed twice, in two sections that disagree about it.

       Which of the two lists the single surviving row lands in is the
       PRE-EXISTING liveness rule (ADR-041/062), untouched here: the hand-booked
       tomorrow row was created BEFORE today's chase, so today's row is the
       lead's newest and tomorrow's row is superseded history. The board agrees
       with that reading — the live follow-up is today's, so on tomorrow the
       card sits in Fallen behind. One row, one place, one story. */
    const lead = await leadDueOn(TOMORROW);
    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "follow_up_again" },
      group: { group: "follow_up", data: { date: TODAY, method: "call" } } as never,
      actor: admin,
      role: "bsystems_admin",
    });
    await setNoAnswer("bsystems", lead.id, true, admin, AT_NOON);

    const tomorrow = await todoFor({
      brand: "bsystems",
      scope: { kind: "all" },
      now: cairoToUtc(TOMORROW, "12:00"),
    });
    const live = tomorrow.today.filter((i) => i.leadId === lead.id);
    const done = tomorrow.done.filter((i) => i.leadId === lead.id);
    expect(live.length + done.length).toBe(1);
    expect(done).toHaveLength(1);
  });

  it("racing presses on one lead still write at most ONE auto follow-up", async () => {
    /* Real Postgres, real overlapping transactions. The row lock serialises
       them, and each one re-reads the live follow-up after acquiring it. */
    const lead = await leadDueOn(TODAY);
    await Promise.all(
      Array.from({ length: 5 }, () => setNoAnswer("bsystems", lead.id, true, admin, AT_NOON)),
    );
    expect(await followUps(lead.id)).toHaveLength(2);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).noAnswerCount).toBe(5);
  });

  it("writes ONE group_added / FU-AUTO row beside the no_answer row", async () => {
    const lead = await leadDueOn(TODAY);
    await setNoAnswer("bsystems", lead.id, true, admin, AT_NOON);
    expect(
      await db.activityLog.count({ where: { entityId: lead.id, trigger: "FU-AUTO" } }),
    ).toBe(1);
    expect(
      await db.activityLog.count({ where: { entityId: lead.id, trigger: "no_answer" } }),
    ).toBe(1);
    const auto = await db.activityLog.findFirstOrThrow({
      where: { entityId: lead.id, trigger: "FU-AUTO" },
    });
    /* the card did not move, so the row carries no stages */
    expect(auto.action).toBe("group_added");
    expect(auto.fromStage).toBeNull();
    expect(auto.toStage).toBeNull();
  });
});

describe("2/3/4. the three cases that must write NOTHING", () => {
  it("a FUTURE follow-up is left exactly alone", async () => {
    const lead = await leadDueOn(nextCairoDate(TODAY));
    await setNoAnswer("bsystems", lead.id, true, admin, AT_NOON);
    expect(await followUps(lead.id)).toHaveLength(1);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).noAnswerCount).toBe(1);
    expect(await db.activityLog.count({ where: { entityId: lead.id, trigger: "FU-AUTO" } })).toBe(
      0,
    );
  });

  it("a FALLEN-BEHIND follow-up is left alone — his explicit instruction", async () => {
    /* "no keep it fallen behind in a separate column I will pick it up and make
       another follow up date." Auto-relogging a lead that is already behind
       would walk it forward one day per press and quietly empty the column he
       asked for. */
    const lead = await leadDueOn("2026-11-01"); // nine days behind TODAY
    await setNoAnswer("bsystems", lead.id, true, admin, AT_NOON);
    const rows = await followUps(lead.id);
    expect(rows).toHaveLength(1);
    expect(utcToCairo(rows[0]!.dueAt).date).toBe("2026-11-01");
    expect(await db.activityLog.count({ where: { entityId: lead.id, trigger: "FU-AUTO" } })).toBe(
      0,
    );
  });

  it("YESTERDAY is behind, not today — the off-by-one that would defeat the column", async () => {
    const yesterday = "2026-11-09";
    const lead = await leadDueOn(yesterday);
    await setNoAnswer("bsystems", lead.id, true, admin, AT_NOON);
    expect(await followUps(lead.id)).toHaveLength(1);
  });

  it("any OTHER stage is left alone, even with a follow-up due today", async () => {
    /* A negotiation response date is a follow-up row due today on a lead that is
       not in Following Up. His sentence named the column. */
    const lead = await leadDueOn(TODAY);
    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "negotiation" },
      group: { group: "negotiation", data: { note: "price pushback" } } as never,
      actor: admin,
      role: "bsystems_admin",
    });
    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "negotiation_follow_up" },
      group: { group: "follow_up", data: { date: TODAY, method: "call" } } as never,
      actor: admin,
      role: "bsystems_admin",
    });
    const before = (await followUps(lead.id)).length;

    await setNoAnswer("bsystems", lead.id, true, admin, AT_NOON);
    expect(await followUps(lead.id)).toHaveLength(before);
  });

  it("a lead in Following Up with NO follow-up at all writes nothing", async () => {
    const lead = await createLead(
      "bsystems",
      { name: "Bare Co", number: "0107773997", type: "cold_call", companyName: "Bare" },
      admin,
    );
    await db.lead.update({ where: { id: lead.id }, data: { stage: "following_up" } });
    await setNoAnswer("bsystems", lead.id, true, admin, AT_NOON);
    expect(await followUps(lead.id)).toHaveLength(0);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).noAnswerCount).toBe(1);
  });

  it("the ANSWERED press never logs anything — it ends the chase", async () => {
    const lead = await leadDueOn(TODAY);
    await setNoAnswer("bsystems", lead.id, true, admin, AT_NOON);
    expect(await followUps(lead.id)).toHaveLength(2);

    await setNoAnswer("bsystems", lead.id, false, admin, AT_NOON);
    expect(await followUps(lead.id)).toHaveLength(2); // nothing added
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).noAnswerCount).toBe(0);
  });

  it("ByteForce gets it too — the founder's parity rule, through its own config", async () => {
    const lead = await createLead(
      "byteforce",
      { name: "BF Chase Co", number: "0107773996", type: "cold_call" },
      admin,
    );
    await applyLeadEvent({
      brand: "byteforce",
      leadId: lead.id,
      event: { type: "next_action", action: "following_up" },
      group: { group: "follow_up", data: { date: TODAY, method: "visit" } } as never,
      actor: admin,
      role: "byteforce_staff",
    });
    await setNoAnswer("byteforce", lead.id, true, admin, AT_NOON);
    const rows = await followUps(lead.id);
    expect(rows).toHaveLength(2);
    expect(utcToCairo(rows[1]!.dueAt).date).toBe(TOMORROW);
    expect(rows[1]!.method).toBe("visit");
  });
});

describe("UNDO takes the auto-logged follow-up with it (the phantom-row trap)", () => {
  it("undoing the press restores the flag, the tally AND deletes the new row", async () => {
    const actor = await makeActor("Undo Chase");
    const lead = await leadDueOn(TODAY, { actor });
    await setNoAnswer("bsystems", lead.id, true, actor, AT_NOON);
    expect(await followUps(lead.id)).toHaveLength(2);

    expect(await pendingUndoFor(actor.id!)).not.toBeNull();
    await performUndo(actor);

    /* the lead is EXACTLY as it was: one follow-up, no marker, no tally */
    const rows = await followUps(lead.id);
    expect(rows).toHaveLength(1);
    expect(utcToCairo(rows[0]!.dueAt).date).toBe(TODAY);
    const row = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(row.noAnswer).toBe(false);
    expect(row.noAnswerCount).toBe(0);
  });

  it("undoing the FOURTH press leaves three attempts and exactly one extra row", async () => {
    /* Each press on a later day logs its own row; undoing the last press must
       delete ITS row and no earlier one — which is why the payload carries ids
       rather than a date predicate. */
    const actor = await makeActor("Undo Chase 4");
    const lead = await leadDueOn(TODAY, { actor });
    let day = TODAY;
    for (let i = 0; i < 4; i += 1) {
      await setNoAnswer("bsystems", lead.id, true, actor, cairoToUtc(day, "12:00"));
      day = nextCairoDate(day);
    }
    expect(await followUps(lead.id)).toHaveLength(5); // the original + four

    await performUndo(actor);
    const rows = await followUps(lead.id);
    expect(rows).toHaveLength(4);
    /* the row that went is the LAST one — the chase is back where the 3rd press
       left it. `day` has walked one past the 4th press, so the 3rd press's row
       is two days behind it. */
    const thirdPressBooked = utcToCairo(rows.at(-1)!.dueAt).date;
    expect(thirdPressBooked).toBe("2026-11-13");
    expect(nextCairoDate(thirdPressBooked)).toBe(day);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).noAnswerCount).toBe(3);
  });

  it("a press that logged NOTHING undoes exactly as it always did", async () => {
    const actor = await makeActor("Undo No Log");
    const lead = await leadDueOn(nextCairoDate(TODAY), { actor }); // future ⇒ no auto-log
    await setNoAnswer("bsystems", lead.id, true, actor, AT_NOON);
    await performUndo(actor);
    expect(await followUps(lead.id)).toHaveLength(1);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).noAnswerCount).toBe(0);
  });

  it("an undo entry written BEFORE ADR-082 (no `created` key) still undoes", async () => {
    /* The deploy window: a pending entry whose payload has only the flag and
       the tally. `deleteCreated` defaults the list to [], so the entry applies
       instead of throwing. */
    const actor = await makeActor("Undo Legacy");
    const lead = await leadDueOn(TODAY, { actor });
    await setNoAnswer("bsystems", lead.id, true, actor, AT_NOON);
    const entry = await db.undoEntry.findFirstOrThrow({
      where: { userId: actor.id!, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    await db.undoEntry.update({
      where: { id: entry.id },
      data: { payload: { noAnswer: false, noAnswerCount: 0 } },
    });

    await performUndo(actor);
    const row = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(row.noAnswerCount).toBe(0);
    /* and the auto-logged row survives, because this entry never recorded it —
       stated rather than hidden: undo only ever deletes ids it wrote down */
    expect(await followUps(lead.id)).toHaveLength(2);
  });

  it("the FINGERPRINT still matches — creating a child row does not touch the lead", async () => {
    const actor = await makeActor("Undo Fingerprint");
    const lead = await leadDueOn(TODAY, { actor });
    await setNoAnswer("bsystems", lead.id, true, actor, AT_NOON);
    const entry = await db.undoEntry.findFirstOrThrow({
      where: { userId: actor.id!, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    const fresh = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(entry.fingerprint).toBe(fresh.updatedAt.toISOString());
  });
});

describe("everything downstream stays honest", () => {
  it("the To-Do: today's row is DONE (superseded), and tomorrow's is not here yet", async () => {
    /* ADR-062 — the chase he just made is handled for today, so it leaves the
       active list for Done rather than vanishing; the new row is tomorrow's
       work and the To-Do is Today-only (ADR-061). */
    const lead = await leadDueOn(TODAY);
    const before = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: AT_NOON });
    expect(before.today.filter((i) => i.leadId === lead.id)).toHaveLength(1);

    await setNoAnswer("bsystems", lead.id, true, admin, AT_NOON);

    const after = await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: AT_NOON });
    expect(after.today.filter((i) => i.leadId === lead.id)).toHaveLength(0);
    const done = after.done.filter((i) => i.leadId === lead.id);
    expect(done).toHaveLength(1);
    expect(done[0]!.done).toEqual({ by: "auto", reason: "superseded" });

    /* and it IS on tomorrow's list */
    const tomorrow = await todoFor({
      brand: "bsystems",
      scope: { kind: "all" },
      now: cairoToUtc(TOMORROW, "12:00"),
    });
    expect(tomorrow.today.filter((i) => i.leadId === lead.id)).toHaveLength(1);
  });

  it("the daily report counts ONE lead for the press, with TWO honest lines", async () => {
    /* ADR-081's headline number is DISTINCT LEADS, so a press that writes two
       log rows must not count the lead twice. Both rows show, because two
       things really happened. */
    const actor = await makeActor("Report Chase");
    const lead = await leadDueOn(TODAY, { actor });
    await setNoAnswer("bsystems", lead.id, true, actor, AT_NOON);

    /* NO injected `now` here, deliberately: `ActivityLog.createdAt` is stamped
       by the database at the real instant of the write, so the report's window
       has to be the real today. The press's own `now` only ever decides which
       DAY the follow-up is booked for. */
    const report = await dailyReportFor({
      actorId: actor.id!,
      companies: [{ brand: "bsystems", scope: { kind: "all" } }],
    });
    const today = report.days[0]!;
    const row = today.leads.find((l) => l.leadId === lead.id)!;
    expect(today.leadCount).toBe(1);
    expect(row.interactions.map((i) => i.trigger)).toContain("FU-AUTO");
    expect(row.interactions.map((i) => i.trigger)).toContain("no_answer");
  });
});

describe("the Cairo calendar, including the days Egypt changes its clocks", () => {
  /* `nextCairoDate` is CALENDAR arithmetic on the date string, never
     `instant + 86_400_000`: Egypt has a 23-hour day and a 25-hour day every
     year, and the fixed-day version lands on the wrong date on both of them —
     invisibly for the other 363. These two days are where that shows. */
  const TRANSITIONS: Array<[string, string, string]> = [
    ["spring forward (clocks jump at midnight)", "2026-04-23", "2026-04-24"],
    ["spring forward, the day itself", "2026-04-24", "2026-04-25"],
    ["autumn back", "2026-10-29", "2026-10-30"],
    ["autumn back, the day itself", "2026-10-30", "2026-10-31"],
  ];

  it.each(TRANSITIONS)("%s: today %s ⇒ tomorrow %s", async (_why, today, tomorrow) => {
    const lead = await leadDueOn(today);
    await setNoAnswer("bsystems", lead.id, true, admin, cairoToUtc(today, "12:00"));
    const rows = await followUps(lead.id);
    expect(rows).toHaveLength(2);
    /* the DAY is what a follow-up is about, and it is never lost */
    expect(utcToCairo(rows[1]!.dueAt).date).toBe(tomorrow);
    expect(rows[1]!.dueTimeSet).toBe(false);
  });

  it("a press late on the Cairo evening still books the NEXT Cairo day", async () => {
    /* 23:30 Cairo is already the next UTC day — the whole reason the day is
       read through utcToCairo rather than off the instant. */
    const lead = await leadDueOn(TODAY);
    await setNoAnswer("bsystems", lead.id, true, admin, cairoToUtc(TODAY, "23:30"));
    const rows = await followUps(lead.id);
    expect(rows).toHaveLength(2);
    expect(utcToCairo(rows[1]!.dueAt).date).toBe(TOMORROW);
  });
});

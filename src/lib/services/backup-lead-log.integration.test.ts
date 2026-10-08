import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { exportBackup, importBackup, BACKUP_VERSION } from "./backup";
import { buildLeadLogs, LEAD_LOG_VERSION, type LeadLog, type LeadLogEntry } from "./backup-log";
import { applyLeadEvent, createLead, setArchived, setNoAnswer } from "./leads";
import { addLeadComment } from "./comments";
import { markLeadWhatsappSent } from "./whatsapp";
import type { Actor } from "./activity";

/* ============================================================================
   ADR-084 — "I want the exact log for each single lead to be extracted."

   The fixture below drags ONE lead through most of its life — created, chased,
   not answering, commented on, messaged, met, quoted, won, invoiced, paid, and
   its tasks ticked — and then asserts that the lead's own section of the backup
   file tells that story back, in order, with the hour on every line.

   AND it asserts the thing that matters more: that the file still RESTORES. A
   log is a convenience; the backup is the company.
   ========================================================================== */

const admin: Actor = { id: null, label: "Backup Admin" };
const role = "bsystems_admin" as const;

beforeEach(async () => {
  await resetDb();
});

/** The whole life of one lead, built through the REAL services so the log is
    asserted against history the product actually writes — not against rows a
    test invented in the shape it hoped for. */
async function buildALifetime() {
  const user = await db.user.create({
    data: { name: "Elmur", email: "admin@byteforce.com", passwordHash: "hash" },
  });
  await db.userRole.create({ data: { userId: user.id, role: "bsystems_admin" } });
  const colleague = await db.user.create({
    data: { name: "Ayman", email: "ayman@bsystems.example", passwordHash: "hash" },
  });

  const lead = await createLead(
    "bsystems",
    { name: "Nile Foods", number: "0100000001", type: "cold_call", companyName: "Nile Foods LLC" },
    admin,
    { ownerType: "admin", ownerUserId: user.id },
  );

  /* chased — a follow-up with a time the caller CHOSE */
  await applyLeadEvent({
    brand: "bsystems",
    leadId: lead.id,
    event: { type: "next_action", action: "following_up" },
    group: {
      group: "follow_up",
      data: { date: "2026-09-01", time: "10:30", method: "call", followingUpWith: "the quote" },
    },
    actor: admin,
    role,
  });

  /* didn't answer, twice — the counter (ADR-064) */
  await setNoAnswer("bsystems", lead.id, true, admin);
  await setNoAnswer("bsystems", lead.id, true, admin);

  /* the chat, and the WhatsApp mark */
  await addLeadComment({
    leadId: lead.id,
    body: "@Elmur he asked for the deck again",
    author: { id: user.id, name: "Elmur" },
  });
  await markLeadWhatsappSent("bsystems", lead.id, { id: user.id, label: "Elmur" });

  /* met — and the meeting blocks a COLLEAGUE's calendar too (ADR-071) */
  await applyLeadEvent({
    brand: "bsystems",
    leadId: lead.id,
    event: { type: "next_action", action: "meeting_setting" },
    group: {
      group: "meeting",
      data: { arranged: true, date: "2026-09-02", time: "14:00", mode: "online" },
    },
    actor: admin,
    role,
  });
  const meeting = await db.meeting.findFirstOrThrow({ where: { leadId: lead.id } });
  /* the roster row directly: `setMeetingAttendees` reaches into the auth guards
     (and so into next-auth, which this runtime has no session for). Its wall is
     ADR-071's own suite; what THIS file needs is the row the backup must carry. */
  await db.meetingAttendee.create({ data: { meetingId: meeting.id, userId: colleague.id } });

  /* quoted */
  await applyLeadEvent({
    brand: "bsystems",
    leadId: lead.id,
    event: { type: "meeting_outcome", outcome: "attended", destination: "sending_proposal" },
    group: {
      group: "proposal",
      data: { service: "Logistics platform", estimatedValue: 500_000_00, sent: false },
    },
    actor: admin,
    role,
  });
  /* marking it SENT is its own event (T-5 / B-6): the engine refuses a group
     that arrives already sent, and the send RETURNS the card to Following Up,
     which demands the next follow-up. That one is left DATE-ONLY on purpose
     (ADR-063) so the log is asserted on both readings — a chosen clock and a
     deliberate absence of one. */
  await applyLeadEvent({
    brand: "bsystems",
    leadId: lead.id,
    event: { type: "proposal_sent" },
    group: { group: "follow_up", data: { date: "2026-09-05", method: "message" } },
    actor: admin,
    role,
  });

  /* won, with one milestone */
  await applyLeadEvent({
    brand: "bsystems",
    leadId: lead.id,
    event: { type: "next_action", action: "won" },
    group: {
      group: "won_deal",
      data: {
        estimatedValue: 500_000_00,
        totalCommissionPercentBp: 10_00,
        milestones: [{ label: "Phase one", value: 500_000_00, commissionValue: 50_000_00 }],
      },
    },
    actor: admin,
    role,
  });

  const milestone = await db.milestone.findFirstOrThrow();
  await db.milestone.update({
    where: { id: milestone.id },
    data: { completed: true, completedAt: new Date("2026-09-10T11:00:00Z") },
  });
  const statement = await db.statement.create({
    data: {
      code: "ST-0001",
      milestoneId: milestone.id,
      clientName: "Nile Foods LLC",
      milestoneLabel: "Phase one",
      milestoneValue: 500_000_00,
      percentBp: 10_00,
      amount: 50_000_00,
      closerUserId: user.id,
      closerLabel: "Elmur",
      status: "paid",
      paidAt: new Date("2026-09-12T09:15:00Z"),
      expectedDate: new Date("2026-09-11T00:00:00Z"),
    },
  });
  /* a payment proof, reachable only through the statement */
  await db.attachment.create({
    data: {
      kind: "payment_proof",
      statementId: statement.id,
      filename: "proof.png",
      storageKey: "proofs/proof.png",
      mime: "image/png",
      size: 1234,
    },
  });
  /* A ticked task, keyed to the MILESTONE — which ADR-062 keys to the RECORD
     and never to a lead, so this is also what proves the log resolves a mark
     back through milestone -> won deal -> lead. Written directly: `setTodoDone`
     enforces "is this task on TODAY's To-Do", a liveness rule its own suite
     owns, and a completed milestone is deliberately not tickable there. */
  await db.todoDone.create({
    data: {
      milestoneId: milestone.id,
      dueAt: new Date("2026-09-10T11:00:00Z"),
      completedById: user.id,
      completedByLabel: "Elmur",
      completedAt: new Date("2026-09-10T12:00:00Z"),
    },
  });
  /* the two groups the engine did not write on this path, created directly so
     the completeness claim covers them too */
  await db.postponeInfo.create({
    data: { leadId: lead.id, reason: "not_answering", note: "quiet for a week" },
  });
  await db.negotiationNote.create({ data: { leadId: lead.id, note: "wants 60-day terms" } });

  return { user, colleague, lead, meeting, milestone, statement };
}

/** The log, asserted PRESENT. It is in the file by DEFAULT (ADR-084) — the keys
    are optional in the type only so `?log=0` can leave them out, and every case
    below is about the default, so every case says so. */
function logsIn(backup: { leadLogs?: LeadLog[] }): LeadLog[] {
  expect(backup.leadLogs, "the export carries the per-lead log by default").toBeDefined();
  return backup.leadLogs!;
}

const kindsOf = (log: LeadLog) => new Set(log.entries.map((e) => e.kind));
const firstOfKind = (log: LeadLog, kind: string): LeadLogEntry =>
  log.entries.find((e) => e.kind === kind)!;

describe("The backup carries each lead's exact log (ADR-084)", () => {
  it("tells the whole story of one lead, oldest first, with the hour on every line", async () => {
    const { lead, colleague } = await buildALifetime();

    const backup = await exportBackup();
    expect(backup.leadLogVersion).toBe(LEAD_LOG_VERSION);
    expect(logsIn(backup)).toHaveLength(1);
    const log = logsIn(backup)[0]!;

    /* the header identifies the lead without opening `tables` */
    expect(log.leadId).toBe(lead.id);
    expect(log.name).toBe("Nile Foods");
    expect(log.companyName).toBe("Nile Foods LLC");
    expect(log.brand).toBe("bsystems");
    expect(log.stage).toBe("won");
    expect(log.archived).toBe(false);
    /* the WhatsApp mark is STATE on the header, not an event — ADR-069 already
       logs every press, and an entry built from these columns would print the
       first press twice */
    expect(log.whatsappSentBy).toBe("Elmur");
    expect(log.whatsappSentAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    /* ---- HIS LIST, item by item: "activities entries comments dates hours
       meetings each single action and when it happend" ---- */
    const kinds = kindsOf(log);
    for (const required of [
      "history", // activities
      "comment", // comments
      "follow_up",
      "meeting", // meetings
      "proposal",
      /* a B-SYSTEMS win writes a WonDeal and its milestones (V2 §4); the
         ByteForce `WonInfo` shape is asserted on its own lead below, because
         no single lead can carry both */
      "won_deal",
      "milestone_completed",
      "statement",
      "statement_paid",
      "task_done",
      "attachment",
      "postponed",
      "negotiation_note",
    ]) {
      expect(kinds, `a lead's log must carry its ${required} entries`).toContain(required);
    }

    /* EVERY entry answers "when", to the hour, twice over: once for machines and
       once on the Cairo wall clock in the product's 12-hour convention (ADR-068).
       This is the assertion his "dates hours" turns into. */
    for (const entry of log.entries) {
      expect(entry.at, entry.kind).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(entry.atCairo, entry.kind).toMatch(/\d{1,2}:\d{2}\s(AM|PM)$/);
      expect(entry.what, entry.kind).toBeTruthy();
      expect(entry.recordId, entry.kind).toBeTruthy();
    }

    /* OLDEST FIRST — the file reads forwards */
    const stamps = log.entries.map((e) => e.at);
    expect([...stamps].sort((a, b) => a.localeCompare(b))).toEqual(stamps);

    /* the history speaks the product's own words (ADR-081's vocabulary, reused
       rather than reinvented) */
    const phrases = log.entries.filter((e) => e.kind === "history").map((e) => e.what);
    expect(phrases).toContain("Added the lead");
    expect(phrases).toContain("Flagged didn't answer");
    expect(phrases).toContain("Commented");
    expect(phrases).toContain("Sent WhatsApp");
    /* the counter pressed twice is TWO entries — "how many times we tried" */
    expect(phrases.filter((p) => p === "Flagged didn't answer")).toHaveLength(2);

    /* the comment carries its text and its author */
    const comment = firstOfKind(log, "comment");
    expect(comment.details.body).toBe("@Elmur he asked for the deck again");
    expect(comment.by).toBe("Elmur");

    /* the follow-up carries the DUE instant and what it is about, and its
       chosen time reads as a clock */
    const followUps = log.entries.filter((e) => e.kind === "follow_up");
    expect(followUps).toHaveLength(2);
    const chosen = followUps.find((e) => e.details.dueTimeChosen === true)!;
    expect(chosen.details.followingUpAbout).toBe("the quote");
    expect(chosen.details.method).toBe("call");
    expect(chosen.details.dueAtCairo).toBe("1 Sept 2026, 10:30 AM") /* en-GB abbreviates September as "Sept" */;

    /* ADR-063 — a follow-up NOBODY gave a time to reads DATE-ONLY in the log.
       Printing "9:00 AM" on it would hand it a clock no one chose, which is the
       exact failure ADR-063 exists to prevent. Its own LOGGED-AT stamp still
       carries the hour, because those are two different questions. */
    const dateOnly = followUps.find((e) => e.details.dueTimeChosen === false)!;
    expect(dateOnly.details.dueAtCairo).toBe("5 Sept 2026");
    expect(dateOnly.details.dueAtCairo).not.toMatch(/AM|PM/);
    expect(dateOnly.atCairo).toMatch(/\d{1,2}:\d{2}\s(AM|PM)$/);

    /* the meeting names the colleague whose calendar it blocks (ADR-071) */
    const meetingEntry = firstOfKind(log, "meeting");
    expect(meetingEntry.details.mode).toBe("online");
    expect(meetingEntry.details.datetimeCairo).toBe("2 Sept 2026, 2:00 PM");
    expect(meetingEntry.details.alsoBlocks).toEqual([{ userId: colleague.id, name: "Ayman" }]);

    /* money is stated in the unit it is stored in, because a human reading this
       file has no schema to consult */
    expect(firstOfKind(log, "proposal").details.estimatedValuePiasters).toBe(500_000_00);
    expect(firstOfKind(log, "won_deal").details.estimatedValuePiasters).toBe(500_000_00);
    expect(firstOfKind(log, "statement").details.amountPiasters).toBe(50_000_00);

    /* THE MILESTONE PLAN rides the deal, because Milestone has no createdAt and
       a plan entry would have to invent an instant */
    const plan = firstOfKind(log, "won_deal").details.milestones as Array<Record<string, unknown>>;
    expect(plan).toHaveLength(1);
    expect(plan[0]!.label).toBe("Phase one");
    expect(plan[0]!.valuePiasters).toBe(500_000_00);

    /* a payment answers "when" with the day the money arrived */
    expect(firstOfKind(log, "statement_paid").at).toBe("2026-09-12T09:15:00.000Z");
    expect(firstOfKind(log, "milestone_completed").at).toBe("2026-09-10T11:00:00.000Z");

    /* the ticked task names who ticked it */
    const task = firstOfKind(log, "task_done");
    expect(task.by).toBe("Elmur");

    /* the proof, reachable only through the statement */
    expect(firstOfKind(log, "attachment").details.filename).toBe("proof.png");
  });

  it("names the actor it knows and stays silent about the one it does not", async () => {
    const { user } = await buildALifetime();
    const log = logsIn(await exportBackup())[0]!;

    /* history and the chat carry a stored actor; the one written by a named
       user carries the id as well */
    const commented = log.entries.find((e) => e.kind === "comment")!;
    expect(commented.by).toBe("Elmur");
    expect(commented.byUserId).toBe(user.id);
    for (const entry of log.entries.filter((e) => e.kind === "history")) {
      expect(entry.by, "every history row has a stored label").toBeTruthy();
    }

    /* THE FIELD GROUPS HAVE NO ACTOR COLUMN IN THIS SCHEMA. The log says so
       rather than borrowing the admin who ran the export — the one thing an
       audit artefact must never do. */
    for (const kind of ["follow_up", "meeting", "proposal", "won_deal", "postponed"]) {
      expect(firstOfKind(log, kind).by, `${kind} must not invent an actor`).toBeNull();
      expect(firstOfKind(log, kind).byUserId, `${kind} must not invent an actor`).toBeNull();
    }
  });

  it("gives an archived lead its log, and keeps two leads' stories apart", async () => {
    const { lead } = await buildALifetime();
    const other = await createLead(
      "byteforce",
      { name: "Delta Trading", number: "0100000002", type: "event_data" },
      admin,
    );
    await addLeadComment({
      leadId: other.id,
      body: "a different lead entirely",
      author: { id: (await db.user.findFirstOrThrow()).id, name: "Elmur" },
    });
    await setArchived("byteforce", other.id, true, admin);

    const logs = logsIn(await exportBackup());
    expect(logs).toHaveLength(2);
    const mine = logs.find((l) => l.leadId === lead.id)!;
    const theirs = logs.find((l) => l.leadId === other.id)!;

    /* an archived lead still has a story, and says it is archived */
    expect(theirs.archived).toBe(true);
    expect(theirs.archivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(theirs.entries.length).toBeGreaterThan(0);
    expect(theirs.entries.map((e) => e.what)).toContain("Archived the lead");

    /* ISOLATION — no entry of one lead reaches the other */
    const bodies = theirs.entries.map((e) => JSON.stringify(e.details));
    expect(bodies.some((b) => b.includes("deck again"))).toBe(false);
    expect(mine.entries.some((e) => e.recordId === theirs.entries[0]!.recordId)).toBe(false);
  });

  it("survives history whose lead is gone — ActivityLog has no foreign key", async () => {
    const { lead } = await buildALifetime();
    /* a row naming a lead that does not exist. The daily report meets these
       routinely (a deleted lead's history outlives it); here there is no lead
       to attach them to, so they belong to no log — and must not throw. */
    await db.activityLog.create({
      data: {
        entityType: "lead",
        entityId: "a-lead-that-was-deleted",
        actorLabel: "Elmur",
        action: "stage_change",
        trigger: "T-1",
        fromStage: "new",
        toStage: "following_up",
      },
    });

    const logs = logsIn(await exportBackup());
    expect(logs.map((l) => l.leadId)).toEqual([lead.id]);
    expect(logs[0]!.entries.some((e) => e.recordId === "a-lead-that-was-deleted")).toBe(false);
  });

  it("is byte-deterministic, so two exports of the same data can be diffed", async () => {
    await buildALifetime();
    const first = await exportBackup();
    const second = buildLeadLogs(first.tables);
    expect(JSON.stringify(second)).toBe(JSON.stringify(logsIn(first)));
  });

  it("carries the ByteForce win figures, which are a different table entirely", async () => {
    const lead = await createLead(
      "byteforce",
      { name: "Cairo Mills", number: "0100000003", type: "personal_connection" },
      admin,
    );
    await applyLeadEvent({
      brand: "byteforce",
      leadId: lead.id,
      event: { type: "next_action", action: "won" },
      group: {
        group: "won",
        data: { estimatedValue: 250_000_00, technicalOwner: "Hassan", collectedAmount: 100_000_00 },
      },
      actor: admin,
      role: "byteforce_staff",
    });

    const log = logsIn(await exportBackup()).find((l) => l.leadId === lead.id)!;
    const won = firstOfKind(log, "won");
    expect(won.details.estimatedValuePiasters).toBe(250_000_00);
    expect(won.details.collectedAmountPiasters).toBe(100_000_00);
    expect(won.details.technicalOwner).toBe("Hassan");
    expect(won.atCairo).toMatch(/\d{1,2}:\d{2}\s(AM|PM)$/);
  });

  it("builds nothing from an empty system rather than failing", () => {
    expect(buildLeadLogs({})).toEqual([]);
    expect(buildLeadLogs({ lead: [] })).toEqual([]);
  });
});

/* ========================================================================== */

describe("The log never breaks the restore (ADR-084's governing constraint)", () => {
  it("restores a wiped system from an export that CARRIES the log", async () => {
    const { lead, user, statement } = await buildALifetime();
    const before = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    const liveNoAnswerCount = before.noAnswerCount;
    const liveNoAnswer = before.noAnswer;
    const backup = await exportBackup();
    expect(logsIn(backup).length).toBeGreaterThan(0); // the log really is in the file
    const json = JSON.parse(JSON.stringify(backup)) as unknown; // a real file round-trip

    await resetDb();
    expect(await db.lead.count()).toBe(0);

    const counts = await importBackup(json, admin);
    expect(counts["lead"]).toBe(1);
    expect(counts["statement"]).toBe(1);

    /* ids preserved, relations intact — the log changed nothing */
    const restored = await db.lead.findUniqueOrThrow({
      where: { id: lead.id },
      include: { comments: true, followUps: true, meetings: true, wonDeal: true },
    });
    expect(restored.ownerUserId).toBe(user.id);
    expect(restored.stage).toBe("won");
    /* NOT a literal: the two presses were later CLEARED by the stage moves that
       followed them (the automatic no-answer clear), so the live value is what
       the restore must reproduce — and reading it from the database before the
       wipe is what makes this an assertion about the RESTORE rather than about
       the pipeline. It also pins the ADR-064 backfill: it must not fire on a
       modern payload and inflate a real zero to one. */
    expect(restored.noAnswerCount).toBe(liveNoAnswerCount);
    expect(restored.noAnswer).toBe(liveNoAnswer);
    expect(restored.comments).toHaveLength(1);
    expect(restored.followUps).toHaveLength(2);
    expect(restored.meetings).toHaveLength(1);
    expect(await db.statement.findUniqueOrThrow({ where: { id: statement.id } })).toBeTruthy();
  });

  it("restores an OLD export that predates the log, unchanged", async () => {
    await buildALifetime();
    const backup = await exportBackup();
    /* exactly what a file downloaded before ADR-084 looks like */
    const old = JSON.parse(JSON.stringify(backup)) as Record<string, unknown>;
    delete old.leadLogs;
    delete old.leadLogVersion;
    expect("leadLogs" in old).toBe(false);

    await resetDb();
    const counts = await importBackup(old, admin);
    expect(counts["lead"]).toBe(1);
    expect(counts["meeting"]).toBe(1);
    expect((await db.lead.findFirstOrThrow()).stage).toBe("won");
  });

  it("ignores the log on the way in — `tables` is the only restore contract", async () => {
    await buildALifetime();
    const backup = await exportBackup();
    const tampered = JSON.parse(JSON.stringify(backup)) as Record<string, unknown>;
    /* a log section that is nonsense, or hostile, or from another system: the
       restore must not read it at all */
    tampered.leadLogs = [{ leadId: "not-a-lead", entries: [{ at: "nonsense" }] }];
    tampered.leadLogVersion = 999;

    await resetDb();
    const counts = await importBackup(tampered, admin);
    expect(counts["lead"]).toBe(1);
    expect(await db.lead.count()).toBe(1);
    expect((await db.lead.findFirstOrThrow()).name).toBe("Nile Foods");
  });

  /* THE ESCAPE HATCH. Measured at 2,000 leads the log is 55% of the file, and
     this file is the one that rebuilds the company — so there is always a way to
     produce it that the log's size cannot defeat. The keys are ABSENT rather
     than empty: `leadLogs: []` would claim no lead has a history. */
  it("can be asked to leave the log out, and that file still restores", async () => {
    const { lead } = await buildALifetime();
    const lean = await exportBackup({ includeLeadLogs: false });
    expect("leadLogs" in lean).toBe(false);
    expect("leadLogVersion" in lean).toBe(false);
    /* `tables` is IDENTICAL either way — the two files restore the same system */
    const full = await exportBackup();
    expect(Object.keys(lean.tables)).toEqual(Object.keys(full.tables));
    expect(lean.tables["lead"]).toHaveLength(full.tables["lead"]!.length);

    await resetDb();
    const counts = await importBackup(JSON.parse(JSON.stringify(lean)), admin);
    expect(counts["lead"]).toBe(1);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).stage).toBe("won");
  });

  /* THE VERSION DECISION, pinned. Adding a key the restore path never reads is
     not a compatibility break, so bumping BACKUP_VERSION would make a file
     written today be REFUSED by a build that could restore it perfectly. */
  it("keeps BACKUP_VERSION where it was, so a new file restores on an old build", async () => {
    await buildALifetime();
    const backup = await exportBackup();
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(BACKUP_VERSION).toBe(1);
    /* the simulation: an older build validates `version > ITS OWN max` — 1 is
       not greater than 1, so the file is accepted and its `tables` restore */
    expect(backup.version > 1).toBe(false);
  });
});

/* ========================================================================== */

describe("ADR-071's calendar rides the backup at last (the bug ADR-084 found)", () => {
  it("exports and restores personal calendar entries and meeting rosters", async () => {
    const { colleague, meeting } = await buildALifetime();
    const event = await db.calendarEvent.create({
      data: {
        userId: colleague.id,
        title: "Dentist",
        startsAt: new Date("2026-09-05T08:00:00Z"),
        endsAt: new Date("2026-09-05T09:00:00Z"),
      },
    });

    const backup = await exportBackup();
    /* BEFORE ADR-084 both of these were absent from the file entirely */
    expect(backup.tables["calendarEvent"]).toHaveLength(1);
    expect(backup.tables["meetingAttendee"]).toHaveLength(1);
    const json = JSON.parse(JSON.stringify(backup)) as unknown;

    await resetDb();
    const counts = await importBackup(json, admin);
    expect(counts["calendarEvent"]).toBe(1);
    expect(counts["meetingAttendee"]).toBe(1);

    /* and they come back attached to the same people and the same meeting —
       the restore used to DELETE these by cascading off user/meeting */
    const restoredEvent = await db.calendarEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(restoredEvent.userId).toBe(colleague.id);
    expect(restoredEvent.title).toBe("Dentist");
    expect(restoredEvent.shared).toBe(false); // ADR-071's default-private survives
    const roster = await db.meetingAttendee.findMany({ where: { meetingId: meeting.id } });
    expect(roster.map((r) => r.userId)).toEqual([colleague.id]);
  });
});

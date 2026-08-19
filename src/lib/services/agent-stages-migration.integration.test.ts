import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { AGENT_STAGES } from "@/lib/pipeline-engine/constants";
import { pendingUndoFor } from "@/lib/services/undo";
import { normaliseAgentStages } from "@/lib/services/backup";

/* ADR-057 — the agent stage rename runs against LIVE data: production holds
   agent cards sitting in the partner columns, and one of them owns a real user
   account. This test executes the SHIPPED migration text (never a copy of it)
   against seeded fixtures and proves, twice over, that:

     · agent following_up → contacted and agent won → qualified
     · every other agent stage, and EVERY partner row, is byte-identical
     · a converted agent keeps converted, agentUserId, its User, its PortalRep
       and its children — a stage-only UPDATE touches no relation
     · pending undo entries holding a DEAD agent stage are retired, together
       with the rest of that user's pending set (Prisma's @updatedAt is
       client-side, so raw SQL would leave the fingerprint guard satisfied and
       undo would write the dead stage straight back — and retiring only the
       offending row would promote an OLDER action to the head of the queue,
       breaking ADR-045's honesty invariant)
     · a second run changes nothing — every WHERE names the OLD value, and a
       pending entry created BETWEEN the two runs survives */

const MIGRATION = path.join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260819180000_agent_stages",
  "migration.sql",
);

/** The migration's own statements, comments stripped — the file is the fixture. */
function migrationStatements(): string[] {
  const sql = readFileSync(MIGRATION, "utf8")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function runMigration(): Promise<void> {
  for (const statement of migrationStatements()) {
    await db.$executeRawUnsafe(statement);
  }
}

let seq = 0;

async function card(kind: string, stage: string, extra: Record<string, unknown> = {}) {
  return db.partnerProspect.create({
    data: {
      kind,
      name: `${kind} ${stage}`,
      number: `010900000${seq++}`,
      stage,
      ...(kind === "partner"
        ? { companyName: `${stage} Co`, businessActivity: "Import/export" }
        : { address: "12 Tahrir St", speciality: "ERP consulting" }),
      ...extra,
    },
  });
}

async function log(entityId: string, fromStage: string | null, toStage: string | null) {
  return db.activityLog.create({
    data: {
      entityType: "partner_prospect",
      entityId,
      actorLabel: "Admin",
      action: "stage_change",
      fromStage,
      toStage,
      trigger: "PP-3",
    },
  });
}

async function undoEntry(entityId: string, stage: string, userId = "admin-1", label = "Moved") {
  return db.undoEntry.create({
    data: {
      userId,
      kind: "prospect_event",
      entityType: "partner_prospect",
      entityId,
      label,
      labelAr: "نُقلت",
      fingerprint: new Date().toISOString(),
      payload: { stage, noAnswer: false, created: [], updated: [] },
    },
  });
}

beforeEach(async () => {
  await resetDb();
  seq = 0;
});

describe("ADR-057 data migration: agent cards move onto the agent stages", () => {
  it("rewrites only agent following_up/won, keeps every relation, and is idempotent", async () => {
    /* ---- fixtures: every agent stage, both partner terminals ---- */
    const agentFollowingUp = await card("agent", "following_up");
    const agentLead = await card("agent", "lead");
    const agentDidntAnswer = await card("agent", "didnt_answer");
    const agentMeeting = await card("agent", "meeting_setting");
    const agentLost = await card("agent", "lost");
    const agentAlreadyMigrated = await card("agent", "qualified", { converted: true });

    /* the dangerous one: an agent at `won` with a LIVE account behind it */
    const agentUser = await db.user.create({
      data: {
        name: "Converted Agent",
        email: "converted.agent@example.com",
        phone: "+201099911122",
        passwordHash: "hash",
        active: true,
        registrationStatus: "approved",
        roles: { create: { role: "bsystems_agent" } },
        portalRep: {
          create: {
            firstName: "Converted",
            lastName: "Agent",
            address: "9 Nile St",
            speciality: "Networking",
          },
        },
      },
      include: { portalRep: true },
    });
    const agentWon = await card("agent", "won", {
      converted: true,
      agentUserId: agentUser.id,
      followUps: { create: { context: "initial", dueAt: new Date(), method: "call" } },
      meetings: { create: { arranged: true, datetime: new Date(), mode: "online" } },
    });

    const partnerFollowingUp = await card("partner", "following_up");
    const partnerWon = await card("partner", "won", { converted: true });
    await db.partner.create({
      data: {
        prospectId: partnerWon.id,
        companyName: "won Co",
        keyPersonName: "Hany",
        keyPersonRole: "GM",
        address: "1 Cairo St",
        number: "0223456789",
        businessActivity: "Import/export",
        importance: "high",
      },
    });

    await log(agentFollowingUp.id, "lead", "following_up");
    await log(agentWon.id, "following_up", "won");
    await log(partnerFollowingUp.id, "lead", "following_up");
    await log(partnerWon.id, "following_up", "won");

    /* ADR-045's HONESTY invariant, the exact shape the reviewer's probe hit:
       ONE admin, two pending entries — an older partner-card move, then the
       agent-card move he actually did last. Retiring only the agent row would
       promote the older one to the head of `pendingUndoFor`, so the button
       would offer to revert something that was NOT his last action. */
    const staleUndo = await undoEntry(partnerFollowingUp.id, "lead", "admin-1", "Moved Acme");
    const agentUndo = await undoEntry(agentWon.id, "following_up", "admin-1", "Moved Yasmin");
    /* a DIFFERENT admin with no agent-card entry: his undo is none of this
       migration's business and must survive untouched */
    const otherAdminUndo = await undoEntry(partnerFollowingUp.id, "lead", "admin-2");

    expect((await pendingUndoFor("admin-1"))?.label).toBe("Moved Yasmin");

    /* ---- BEFORE ---- */
    const before = await stageCounts();
    expect(before).toEqual({
      "agent:lead": 1,
      "agent:following_up": 1,
      "agent:didnt_answer": 1,
      "agent:meeting_setting": 1,
      "agent:qualified": 1,
      "agent:won": 1,
      "agent:lost": 1,
      "partner:following_up": 1,
      "partner:won": 1,
    });

    await runMigration();

    /* ---- AFTER: the two renames ---- */
    const after = await stageCounts();
    expect(after).toEqual({
      "agent:lead": 1,
      "agent:contacted": 1,
      "agent:didnt_answer": 1,
      "agent:meeting_setting": 1,
      "agent:qualified": 2, // the pre-migrated one + the converted one
      "agent:lost": 1,
      "partner:following_up": 1, // partner rows do NOT move
      "partner:won": 1,
    });

    expect((await fresh(agentFollowingUp.id)).stage).toBe("contacted");
    expect((await fresh(agentWon.id)).stage).toBe("qualified");
    for (const [row, stage] of [
      [agentLead, "lead"],
      [agentDidntAnswer, "didnt_answer"],
      [agentMeeting, "meeting_setting"],
      [agentLost, "lost"],
      [agentAlreadyMigrated, "qualified"],
      [partnerFollowingUp, "following_up"],
      [partnerWon, "won"],
    ] as const) {
      expect((await fresh(row.id)).stage).toBe(stage);
    }

    /* every agent card now sits on a stage the agent board actually renders */
    const agentStages = await db.partnerProspect.findMany({
      where: { kind: "agent" },
      select: { stage: true },
    });
    for (const { stage } of agentStages) {
      expect(AGENT_STAGES as readonly string[]).toContain(stage);
    }

    /* ---- the converted agent kept its whole account ---- */
    const converted = await db.partnerProspect.findUniqueOrThrow({
      where: { id: agentWon.id },
      include: { followUps: true, meetings: true },
    });
    expect(converted.converted).toBe(true);
    expect(converted.agentUserId).toBe(agentUser.id);
    expect(converted.followUps).toHaveLength(1);
    expect(converted.meetings).toHaveLength(1);
    const stillThere = await db.user.findUniqueOrThrow({
      where: { id: agentUser.id },
      include: { roles: true, portalRep: true },
    });
    expect(stillThere.active).toBe(true);
    expect(stillThere.registrationStatus).toBe("approved");
    expect(stillThere.roles.map((r) => r.role)).toEqual(["bsystems_agent"]);
    expect(stillThere.portalRep!.id).toBe(agentUser.portalRep!.id);
    /* and the partner's directory record is equally untouched */
    expect(await db.partner.count({ where: { prospectId: partnerWon.id } })).toBe(1);

    /* ---- history speaks the agent vocabulary, partners' does not ---- */
    const agentLogs = await db.activityLog.findMany({
      where: { entityId: { in: [agentFollowingUp.id, agentWon.id] } },
      orderBy: { createdAt: "asc" },
    });
    expect(agentLogs.map((l) => [l.fromStage, l.toStage])).toEqual([
      ["lead", "contacted"],
      ["contacted", "qualified"],
    ]);
    const partnerLogs = await db.activityLog.findMany({
      where: { entityId: { in: [partnerFollowingUp.id, partnerWon.id] } },
      orderBy: { createdAt: "asc" },
    });
    expect(partnerLogs.map((l) => [l.fromStage, l.toStage])).toEqual([
      ["lead", "following_up"],
      ["following_up", "won"],
    ]);

    /* ---- the stranding guard ---- */
    const consumed = async (id: string) =>
      (await db.undoEntry.findUniqueOrThrow({ where: { id } })).consumedAt !== null;
    expect(await consumed(agentUndo.id)).toBe(true);
    /* and the entry UNDERNEATH it, so nothing older is promoted to the head */
    expect(await consumed(staleUndo.id)).toBe(true);
    expect(await pendingUndoFor("admin-1")).toBeNull();
    /* the other admin is untouched — the guard is scoped to affected users */
    expect(await consumed(otherAdminUndo.id)).toBe(false);
    expect((await pendingUndoFor("admin-2"))?.id).toBe(otherAdminUndo.id);

    /* ---- IDEMPOTENCE: run it again, nothing moves ---- */
    const snapshot = await fullSnapshot();
    /* the case a back-to-back re-run structurally CANNOT catch: an undo written
       AFTER the migration, on a card the migration touched. Statement 3's
       predicate names the OLD snapshot stage, so this must survive. */
    const afterDeployUndo = await undoEntry(agentWon.id, "meeting_setting", "admin-1");
    await runMigration();
    expect(await fullSnapshot()).toEqual(snapshot);
    expect(await stageCounts()).toEqual(after);
    expect(await consumed(afterDeployUndo.id)).toBe(false);
    expect((await pendingUndoFor("admin-1"))?.id).toBe(afterDeployUndo.id);
    expect(await consumed(otherAdminUndo.id)).toBe(false);
  });

  it("is safe on a database that has already been migrated end to end", async () => {
    const alreadyContacted = await card("agent", "contacted");
    const alreadyQualified = await card("agent", "qualified", { converted: true });
    const partner = await card("partner", "following_up");
    const untouchedUndo = await undoEntry(alreadyContacted.id, "lead");

    const before = await fullSnapshot();
    await runMigration();
    expect(await fullSnapshot()).toEqual(before);
    expect((await fresh(alreadyContacted.id)).stage).toBe("contacted");
    expect((await fresh(alreadyQualified.id)).stage).toBe("qualified");
    expect((await fresh(partner.id)).stage).toBe("following_up");
    /* the guard is scoped to snapshots holding a DEAD stage, so a live undo on
       an already-migrated database is not collateral damage */
    expect((await db.undoEntry.findUniqueOrThrow({ where: { id: untouchedUndo.id } })).consumedAt)
      .toBeNull();
  });

  /* ADR-057 Decision 8(b): `importBackup` re-inserts a PRE-rename export
     verbatim onto a migrated database — the one path the SQL cannot reach — so
     it runs a TypeScript twin of these statements. The twin is only worth
     anything if it agrees with the file; this runs both against identical
     fixtures and diffs the whole result. */
  it("importBackup's normalisation matches the shipped SQL statement for statement", async () => {
    async function fixtures() {
      const followingUp = await card("agent", "following_up");
      const won = await card("agent", "won", { converted: true });
      const lead = await card("agent", "lead");
      const partner = await card("partner", "following_up");
      const partnerWon = await card("partner", "won");
      await log(followingUp.id, "lead", "following_up");
      await log(won.id, "following_up", "won");
      await log(partner.id, "lead", "following_up");
      await log(partnerWon.id, "following_up", "won");
      await undoEntry(partner.id, "lead", "admin-1", "older");
      await undoEntry(won.id, "won", "admin-1", "newer");
      await undoEntry(lead.id, "lead", "bystander", "bystander");
    }

    /* two identical worlds, distinguished only by which normaliser ran */
    await fixtures();
    await runMigration();
    const sqlWorld = await normalisedSnapshot();
    const sqlPending = await pendingUndoFor("admin-1");
    const sqlBystander = await pendingUndoFor("bystander");

    await resetDb();
    seq = 0;
    await fixtures();
    await db.$transaction((tx) => normaliseAgentStages(tx));
    const tsWorld = await normalisedSnapshot();

    expect(tsWorld).toEqual(sqlWorld);
    expect(await pendingUndoFor("admin-1")).toBeNull();
    expect(sqlPending).toBeNull();
    /* the bystander's offer survives BOTH — his card never held a dead stage */
    expect((await pendingUndoFor("bystander"))?.label).toBe("bystander");
    expect(sqlBystander?.label).toBe("bystander");
    /* and both really did the work, rather than both doing nothing */
    expect(tsWorld.prospects.map((p) => p.stage).sort()).toEqual([
      "contacted",
      "following_up",
      "lead",
      "qualified",
      "won",
    ]);
    expect(tsWorld.logs.some((l) => l.toStage === "qualified")).toBe(true);
    expect(tsWorld.undo.filter((u) => u.consumed).length).toBe(2);
  });
});

async function fresh(id: string) {
  return db.partnerProspect.findUniqueOrThrow({ where: { id } });
}

async function stageCounts(): Promise<Record<string, number>> {
  const rows = await db.partnerProspect.findMany({ select: { kind: true, stage: true } });
  const counts: Record<string, number> = {};
  for (const r of rows) counts[`${r.kind}:${r.stage}`] = (counts[`${r.kind}:${r.stage}`] ?? 0) + 1;
  return counts;
}

/** Every fact the two normalisers must agree on, keyed by NAME rather than id
    (the two worlds are separate inserts, so ids differ by construction). */
async function normalisedSnapshot() {
  const prospects = await db.partnerProspect.findMany({
    orderBy: { name: "asc" },
    select: { name: true, kind: true, stage: true, converted: true },
  });
  const byId = new Map(
    (await db.partnerProspect.findMany({ select: { id: true, name: true } })).map((p) => [
      p.id,
      p.name,
    ]),
  );
  const logs = (
    await db.activityLog.findMany({
      orderBy: { createdAt: "asc" },
      select: { entityId: true, fromStage: true, toStage: true, trigger: true },
    })
  ).map((l) => ({
    card: byId.get(l.entityId) ?? l.entityId,
    fromStage: l.fromStage,
    toStage: l.toStage,
    trigger: l.trigger,
  }));
  const undo = (
    await db.undoEntry.findMany({
      orderBy: { createdAt: "asc" },
      select: { label: true, consumedAt: true },
    })
  ).map((u) => ({ label: u.label, consumed: u.consumedAt !== null }));
  return { prospects, logs, undo };
}

async function fullSnapshot() {
  const prospects = await db.partnerProspect.findMany({
    orderBy: { id: "asc" },
    select: { id: true, kind: true, stage: true, converted: true, agentUserId: true },
  });
  const logs = await db.activityLog.findMany({
    orderBy: { id: "asc" },
    select: { id: true, entityId: true, fromStage: true, toStage: true, trigger: true },
  });
  return { prospects, logs };
}

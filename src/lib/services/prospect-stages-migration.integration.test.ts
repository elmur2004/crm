import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { PROSPECT_STAGES } from "@/lib/pipeline-engine/constants";
import { pendingUndoFor } from "@/lib/services/undo";
import { normaliseProspectStages } from "@/lib/services/backup";

/* ADR-057, then ADR-059 — the prospect stage renames run against LIVE data:
   production holds cards sitting in columns the board no longer has, and some
   of them own a real user account or a real directory Partner. This test
   executes the SHIPPED migration text of BOTH folders, in committed order and
   never a copy of it, against seeded fixtures, and proves twice over that:

     · agent rows moved first (ADR-057), partner rows follow (ADR-059):
       following_up → contacted and won → qualified, for both kinds
     · every other stage is byte-identical, and INTERNAL LEAD history — which
       still uses `following_up` and `won` as live stage names — is untouched
     · a converted agent keeps converted, agentUserId, its User, its PortalRep
       and its children; a converted partner keeps its directory row and its
       attributed leads — a stage-only UPDATE touches no relation
     · pending undo entries holding a DEAD stage are retired, together with the
       rest of that user's pending set (Prisma's @updatedAt is client-side, so
       raw SQL would leave the fingerprint guard satisfied and undo would write
       the dead stage straight back — and retiring only the offending row would
       promote an OLDER action to the head of the queue, breaking ADR-045's
       honesty invariant)
     · a second run changes nothing — every WHERE names the OLD value, and a
       pending entry created BETWEEN the two runs survives
     · and `importBackup`'s TypeScript twin agrees with the SQL statement for
       statement (the one path the migrations cannot reach) */

/** Both shipped folders, in the order git committed them. Reading the FILES is
    the whole point: a copy of the SQL in here would drift silently. */
const MIGRATIONS = ["20260819180000_agent_stages", "20260821180000_unified_prospect_stages"].map(
  (folder) => path.join(process.cwd(), "prisma", "migrations", folder, "migration.sql"),
);

/** The migrations' own statements, comments stripped — the files are the fixture. */
function migrationStatements(): string[] {
  return MIGRATIONS.flatMap((file) => {
    const sql = readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
    return sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  });
}

async function runMigrations(): Promise<void> {
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

async function undoEntry(
  entityId: string,
  stage: string,
  userId = "admin-1",
  label = "Moved",
  fingerprint = new Date().toISOString(),
) {
  return db.undoEntry.create({
    data: {
      userId,
      kind: "prospect_event",
      entityType: "partner_prospect",
      entityId,
      label,
      labelAr: "نُقلت",
      fingerprint,
      payload: { stage, noAnswer: false, created: [], updated: [] },
    },
  });
}

/** name → `updatedAt`, the column BOTH normalisers must leave alone. Neither
    path may bump it: undo fingerprints the card's `updatedAt` and the board
    orders by it, so a client-side `@updatedAt` on one path and raw SQL on the
    other is a silent behaviour fork. */
async function updatedAtByName(): Promise<Record<string, string>> {
  const rows = await db.partnerProspect.findMany({ select: { name: true, updatedAt: true } });
  return Object.fromEntries(rows.map((r) => [r.name, r.updatedAt.toISOString()]));
}

beforeEach(async () => {
  await resetDb();
  seq = 0;
});

describe("ADR-057 + ADR-059 data migration: every prospect card lands on the shared stages", () => {
  it("rewrites following_up/won for BOTH kinds, keeps every relation, and is idempotent", async () => {
    /* ---- fixtures: every stage, both kinds, plus the dangerous converted pair ---- */
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

    const partnerLead = await card("partner", "lead");
    const partnerDidntAnswer = await card("partner", "didnt_answer");
    const partnerMeeting = await card("partner", "meeting_setting");
    const partnerLost = await card("partner", "lost");
    const partnerFollowingUp = await card("partner", "following_up");
    /* AN UNEXPECTED KIND. The predicate is `kind <> 'agent'` — the exact
       complement of the runtime rule (`partnersConfigFor`: anything that is not
       an agent is a partner card) — so a row carrying a kind nobody planned for
       is MIGRATED rather than stranded in a column the board does not render.
       Narrow the seven predicates to `kind = 'partner'` and these two rows are
       what fails, at the PROSPECT_STAGES containment assertion below. */
    const resellerFollowingUp = await card("reseller", "following_up");
    const resellerWon = await card("reseller", "won");
    const partnerWon = await card("partner", "won", {
      converted: true,
      followUps: { create: { context: "initial", dueAt: new Date(), method: "call" } },
    });
    const directoryPartner = await db.partner.create({
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

    /* an attributed lead hanging off the converted partner, and its OWN history
       — an internal lead legitimately lives in `following_up`, and the join must
       never rewrite it */
    const attributedLead = await db.lead.create({
      data: {
        brand: "bsystems",
        source: "partner",
        partnerId: directoryPartner.id,
        name: "Referred Client",
        number: "0231000100",
        type: "personal_connection",
        stage: "following_up",
      },
    });
    const internalLeadLog = await db.activityLog.create({
      data: {
        entityType: "lead",
        entityId: attributedLead.id,
        actorLabel: "Admin",
        action: "stage_change",
        fromStage: "new",
        toStage: "following_up",
        trigger: "T-1",
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
    const staleUndo = await undoEntry(agentLead.id, "lead", "admin-1", "Moved Acme");
    const agentUndo = await undoEntry(agentWon.id, "following_up", "admin-1", "Moved Yasmin");
    /* the same shape on the PARTNER half, which is ADR-059's own job */
    const partnerStaleUndo = await undoEntry(agentLead.id, "lead", "admin-3", "Moved older");
    const partnerUndo = await undoEntry(partnerWon.id, "won", "admin-3", "Moved Alexandria");
    /* a DIFFERENT admin with no affected entry at all: his undo is none of this
       migration's business and must survive untouched */
    const otherAdminUndo = await undoEntry(agentLead.id, "lead", "admin-2");

    expect((await pendingUndoFor("admin-1"))?.label).toBe("Moved Yasmin");
    expect((await pendingUndoFor("admin-3"))?.label).toBe("Moved Alexandria");

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
      "partner:lead": 1,
      "partner:following_up": 1,
      "partner:didnt_answer": 1,
      "partner:meeting_setting": 1,
      "partner:won": 1,
      "partner:lost": 1,
      "reseller:following_up": 1,
      "reseller:won": 1,
    });

    await runMigrations();

    /* ---- AFTER: the two renames, now on BOTH kinds ---- */
    const after = await stageCounts();
    expect(after).toEqual({
      "agent:lead": 1,
      "agent:contacted": 1,
      "agent:didnt_answer": 1,
      "agent:meeting_setting": 1,
      "agent:qualified": 2, // the pre-migrated one + the converted one
      "agent:lost": 1,
      "partner:lead": 1,
      "partner:contacted": 1,
      "partner:didnt_answer": 1,
      "partner:meeting_setting": 1,
      "partner:qualified": 1,
      "partner:lost": 1,
      /* the unexpected kind travelled with the partner cards, as `kind <> 'agent'` promises */
      "reseller:contacted": 1,
      "reseller:qualified": 1,
    });

    expect((await fresh(resellerFollowingUp.id)).stage).toBe("contacted");
    expect((await fresh(resellerWon.id)).stage).toBe("qualified");
    expect((await fresh(agentFollowingUp.id)).stage).toBe("contacted");
    expect((await fresh(agentWon.id)).stage).toBe("qualified");
    expect((await fresh(partnerFollowingUp.id)).stage).toBe("contacted");
    expect((await fresh(partnerWon.id)).stage).toBe("qualified");
    for (const [row, stage] of [
      [agentLead, "lead"],
      [agentDidntAnswer, "didnt_answer"],
      [agentMeeting, "meeting_setting"],
      [agentLost, "lost"],
      [agentAlreadyMigrated, "qualified"],
      [partnerLead, "lead"],
      [partnerDidntAnswer, "didnt_answer"],
      [partnerMeeting, "meeting_setting"],
      [partnerLost, "lost"],
    ] as const) {
      expect((await fresh(row.id)).stage).toBe(stage);
    }

    /* EVERY card now sits on a stage the one board actually renders — the
       assertion that catches a row stranded in no column at all */
    const allStages = await db.partnerProspect.findMany({ select: { stage: true } });
    expect(allStages.length).toBeGreaterThan(0);
    for (const { stage } of allStages) {
      expect(PROSPECT_STAGES as readonly string[]).toContain(stage);
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
    /* ---- the converted PARTNER kept its whole directory record ---- */
    const convertedPartner = await db.partnerProspect.findUniqueOrThrow({
      where: { id: partnerWon.id },
      include: { partner: { include: { leads: true } }, followUps: true },
    });
    expect(convertedPartner.converted).toBe(true);
    expect(convertedPartner.partner?.id).toBe(directoryPartner.id);
    expect(convertedPartner.partner?.leads.map((l) => l.id)).toEqual([attributedLead.id]);
    expect(convertedPartner.followUps).toHaveLength(1);

    /* ---- BOTH kinds' history speaks the shared vocabulary ---- */
    const cardLogs = await db.activityLog.findMany({
      where: {
        entityType: "partner_prospect",
        entityId: { in: [agentFollowingUp.id, agentWon.id, partnerFollowingUp.id, partnerWon.id] },
      },
      orderBy: { createdAt: "asc" },
    });
    expect(cardLogs.map((l) => [l.fromStage, l.toStage])).toEqual([
      ["lead", "contacted"],
      ["contacted", "qualified"],
      ["lead", "contacted"],
      ["contacted", "qualified"],
    ]);
    /* ...and an INTERNAL LEAD's history is NOT collateral damage: `following_up`
       is a live stage name over there, so the entityType filter is load-bearing */
    const internal = await db.activityLog.findUniqueOrThrow({ where: { id: internalLeadLog.id } });
    expect([internal.fromStage, internal.toStage]).toEqual(["new", "following_up"]);
    expect((await db.lead.findUniqueOrThrow({ where: { id: attributedLead.id } })).stage).toBe(
      "following_up",
    );

    /* ---- the stranding guard ---- */
    const consumed = async (id: string) =>
      (await db.undoEntry.findUniqueOrThrow({ where: { id } })).consumedAt !== null;
    expect(await consumed(agentUndo.id)).toBe(true);
    /* and the entry UNDERNEATH it, so nothing older is promoted to the head */
    expect(await consumed(staleUndo.id)).toBe(true);
    expect(await pendingUndoFor("admin-1")).toBeNull();
    /* the same, on the partner half ADR-059 owns */
    expect(await consumed(partnerUndo.id)).toBe(true);
    expect(await consumed(partnerStaleUndo.id)).toBe(true);
    expect(await pendingUndoFor("admin-3")).toBeNull();
    /* the other admin is untouched — the guard is scoped to affected users */
    expect(await consumed(otherAdminUndo.id)).toBe(false);
    expect((await pendingUndoFor("admin-2"))?.id).toBe(otherAdminUndo.id);

    /* ---- IDEMPOTENCE: run it again, nothing moves ---- */
    const snapshot = await fullSnapshot();
    /* the case a back-to-back re-run structurally CANNOT catch: an undo written
       AFTER the migration, on a card the migration touched. Statement 3's
       predicate names the OLD snapshot stage, so this must survive. */
    const afterDeployUndo = await undoEntry(agentWon.id, "meeting_setting", "admin-1");
    await runMigrations();
    expect(await fullSnapshot()).toEqual(snapshot);
    expect(await stageCounts()).toEqual(after);
    expect(await consumed(afterDeployUndo.id)).toBe(false);
    expect((await pendingUndoFor("admin-1"))?.id).toBe(afterDeployUndo.id);
    expect(await consumed(otherAdminUndo.id)).toBe(false);
  });

  it("is safe on a database that has already been migrated end to end", async () => {
    const alreadyContacted = await card("agent", "contacted");
    const alreadyQualified = await card("agent", "qualified", { converted: true });
    const partnerContacted = await card("partner", "contacted");
    const partnerWaiting = await card("partner", "waiting");
    const untouchedUndo = await undoEntry(alreadyContacted.id, "lead");

    const before = await fullSnapshot();
    await runMigrations();
    expect(await fullSnapshot()).toEqual(before);
    expect((await fresh(alreadyContacted.id)).stage).toBe("contacted");
    expect((await fresh(alreadyQualified.id)).stage).toBe("qualified");
    expect((await fresh(partnerContacted.id)).stage).toBe("contacted");
    /* the founder's new column is not something the migration invents or eats */
    expect((await fresh(partnerWaiting.id)).stage).toBe("waiting");
    /* the guard is scoped to snapshots holding a DEAD stage, so a live undo on
       an already-migrated database is not collateral damage */
    expect((await db.undoEntry.findUniqueOrThrow({ where: { id: untouchedUndo.id } })).consumedAt)
      .toBeNull();
  });

  /* ADR-057 Decision 8(b), still true under ADR-059: `importBackup` re-inserts a
     PRE-rename export verbatim onto a migrated database — the one path the SQL
     cannot reach — so it runs a TypeScript twin of these statements. The twin is
     only worth anything if it agrees with the FILES; this runs both against
     identical fixtures and diffs the whole result. */
  it("importBackup's normalisation matches the shipped SQL statement for statement", async () => {
    async function fixtures() {
      const followingUp = await card("agent", "following_up");
      const won = await card("agent", "won", { converted: true });
      const lead = await card("agent", "lead");
      const partner = await card("partner", "following_up");
      const partnerWon = await card("partner", "won", { converted: true });
      const partnerWaiting = await card("partner", "waiting");
      await log(followingUp.id, "lead", "following_up");
      await log(won.id, "following_up", "won");
      await log(partner.id, "lead", "following_up");
      await log(partnerWon.id, "following_up", "won");
      await undoEntry(lead.id, "lead", "admin-1", "older");
      await undoEntry(won.id, "won", "admin-1", "newer");
      await undoEntry(partnerWon.id, "won", "admin-9", "partner newer");
      await undoEntry(partnerWaiting.id, "waiting", "bystander", "bystander");
      /* THE SURVIVING ENTRY (reviewer, Run 061). A pending undo on a card the
         rename MOVES, whose snapshot names a still-LIVE stage: the guard leaves
         it pending on both paths, which is only honest if the fingerprint it
         froze still matches the card afterwards. Prisma's client-side
         `@updatedAt` on the twin would move the card underneath it and the
         button would offer a revert that 409s for ever. */
      await undoEntry(
        partner.id,
        "lead",
        "survivor",
        "Moved following_up Co to Following Up",
        partner.updatedAt.toISOString(),
      );
    }

    /* two identical worlds, distinguished only by which normaliser ran */
    await fixtures();
    const sqlBefore = await updatedAtByName();
    await runMigrations();
    const sqlWorld = await normalisedSnapshot();
    const sqlAfter = await updatedAtByName();
    const sqlPending = await pendingUndoFor("admin-1");
    const sqlPartnerPending = await pendingUndoFor("admin-9");
    const sqlBystander = await pendingUndoFor("bystander");
    const sqlSurvivor = await pendingUndoFor("survivor");

    await resetDb();
    seq = 0;
    await fixtures();
    const tsBefore = await updatedAtByName();
    await db.$transaction((tx) => normaliseProspectStages(tx));
    const tsWorld = await normalisedSnapshot();
    const tsAfter = await updatedAtByName();

    expect(tsWorld).toEqual(sqlWorld);
    /* neither path may touch `updatedAt` — the SQL cannot, and the twin must
       not (hence the raw UPDATE in normaliseProspectStages) */
    expect(sqlAfter).toEqual(sqlBefore);
    expect(tsAfter).toEqual(tsBefore);
    /* ...so the entry the guard left pending is still APPLICABLE on both paths */
    const survivorRow = tsWorld.undo.find((u) => u.label.startsWith("Moved following_up Co"));
    expect(survivorRow).toEqual({
      label: "Moved following_up Co to Following Up",
      consumed: false,
      fingerprintValid: true,
    });
    expect((await pendingUndoFor("survivor"))?.label).toBe("Moved following_up Co to Following Up");
    expect(sqlSurvivor?.label).toBe("Moved following_up Co to Following Up");
    expect(await pendingUndoFor("admin-1")).toBeNull();
    expect(sqlPending).toBeNull();
    expect(await pendingUndoFor("admin-9")).toBeNull();
    expect(sqlPartnerPending).toBeNull();
    /* the bystander's offer survives BOTH — his card never held a dead stage */
    expect((await pendingUndoFor("bystander"))?.label).toBe("bystander");
    expect(sqlBystander?.label).toBe("bystander");
    /* and both really did the work, rather than both doing nothing */
    expect(tsWorld.prospects.map((p) => p.stage).sort()).toEqual([
      "contacted",
      "contacted",
      "lead",
      "qualified",
      "qualified",
      "waiting",
    ]);
    expect(tsWorld.logs.filter((l) => l.toStage === "qualified")).toHaveLength(2);
    expect(tsWorld.logs.some((l) => l.toStage === "won")).toBe(false);
    expect(tsWorld.undo.filter((u) => u.consumed).length).toBe(3);
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
  /* `fingerprintValid` is the reviewer's Run 061 addition: an entry the guard
     deliberately leaves PENDING is only honest if `performUndo` would still
     accept it, and that check is `prospect.updatedAt === entry.fingerprint`.
     Comparing the flag rather than the timestamp keeps the two worlds (separate
     inserts, different clocks) comparable while still diffing the column. */
  const stamps = new Map(
    (await db.partnerProspect.findMany({ select: { id: true, updatedAt: true } })).map((p) => [
      p.id,
      p.updatedAt.toISOString(),
    ]),
  );
  const undo = (
    await db.undoEntry.findMany({
      orderBy: { createdAt: "asc" },
      select: { label: true, consumedAt: true, entityId: true, fingerprint: true },
    })
  ).map((u) => ({
    label: u.label,
    consumed: u.consumedAt !== null,
    fingerprintValid: stamps.get(u.entityId) === u.fingerprint,
  }));
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

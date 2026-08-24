import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { exportBackup, importBackup } from "./backup";
import { applyLeadEvent, createLead } from "./leads";
import { storage } from "@/lib/storage";
import type { Actor } from "./activity";
import { pendingUndoFor } from "./undo";

/* Founder directive: export → WIPE EVERYTHING → import restores the system
   exactly — rows, relations (ids preserved), and uploaded files. */

const admin: Actor = { id: null, label: "Backup Admin" };

beforeEach(async () => {
  await resetDb();
});

describe("Full backup round-trip", () => {
  it("restores a wiped system exactly from its own export (data + files)", async () => {
    /* ---- build a system worth restoring ---- */
    const user = await db.user.create({
      data: { name: "Elmur", email: "admin@byteforce.com", passwordHash: "hash" },
    });
    await db.userRole.create({ data: { userId: user.id, role: "bsystems_admin" } });

    const lead = await createLead(
      "bsystems",
      { name: "Backup Corp", number: "0100000001", type: "cold_call" },
      admin,
      { ownerType: "admin", ownerUserId: user.id },
    );
    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "won" },
      group: {
        group: "won_deal",
        data: {
          estimatedValue: 100_000_00,
          totalCommissionPercentBp: 10_00,
          milestones: [{ label: "Only", value: 100_000_00, commissionValue: 10_000_00 }],
        },
      },
      actor: admin,
      role: "bsystems_admin",
    });
    await db.notification.create({
      data: { userId: null, type: "ready_to_close", title: "t", body: "b", leadId: lead.id },
    });
    await db.leadComment.create({
      data: {
        leadId: lead.id,
        authorUserId: user.id,
        authorLabel: "Elmur",
        body: "@Elmur context survives backups",
        mentions: JSON.stringify([{ userId: user.id, name: "Elmur" }]),
      },
    });
    /* ADR-062 — a manual To-Do completion mark rides the backup too (keyed to
       the won deal's milestone; ids preserved keeps the FK intact) */
    const milestone = await db.milestone.findFirstOrThrow({
      where: { wonDeal: { leadId: lead.id } },
    });
    await db.todoDone.create({
      data: {
        milestoneId: milestone.id,
        dueAt: new Date("2026-08-20T06:00:00Z"),
        completedById: user.id,
        completedByLabel: "Elmur",
      },
    });
    const fileKey = "backupintegrationtest1.png";
    await storage.put(fileKey, Buffer.from("png-bytes-here"));
    await db.attachment.create({
      data: {
        kind: "payment_proof",
        filename: "proof.png",
        storageKey: fileKey,
        mime: "image/png",
        size: 14,
      },
    });

    /* ---- export, then destroy EVERYTHING ---- */
    const backup = await exportBackup();
    const json = JSON.parse(JSON.stringify(backup)) as unknown; // real file round-trip
    await resetDb();
    await storage.delete(fileKey);
    expect(await db.user.count()).toBe(0);
    expect(await db.lead.count()).toBe(0);

    /* ---- import the exact exported file ---- */
    const counts = await importBackup(json, admin);
    expect(counts["user"]).toBe(1);
    expect(counts["lead"]).toBe(1);
    expect(counts["milestone"]).toBe(1);
    expect(counts["todoDone"]).toBe(1);

    const restoredUser = await db.user.findUniqueOrThrow({
      where: { email: "admin@byteforce.com" },
      include: { roles: true },
    });
    expect(restoredUser.id).toBe(user.id); // ids preserved
    expect(restoredUser.roles.map((r) => r.role)).toEqual(["bsystems_admin"]);

    const restoredLead = await db.lead.findUniqueOrThrow({
      where: { id: lead.id },
      include: { wonDeal: { include: { milestones: true } } },
    });
    expect(restoredLead.stage).toBe("won");
    expect(restoredLead.ownerUserId).toBe(user.id); // relations intact
    expect(restoredLead.wonDeal!.estimatedValue).toBe(100_000_00);
    expect(restoredLead.wonDeal!.milestones[0]!.commissionValue).toBe(10_000_00);
    expect(restoredLead.createdAt).toBeInstanceOf(Date); // dates round-trip

    /* the completion mark survives with its FK and completer intact (ADR-062) */
    const restoredMark = await db.todoDone.findUniqueOrThrow({
      where: { milestoneId: milestone.id },
    });
    expect(restoredMark.completedById).toBe(user.id);
    expect(restoredMark.completedByLabel).toBe("Elmur");
    expect(restoredMark.dueAt.getTime()).toBe(new Date("2026-08-20T06:00:00Z").getTime());

    expect(await db.notification.count()).toBe(1);
    const restoredComment = await db.leadComment.findFirstOrThrow();
    expect(restoredComment.leadId).toBe(lead.id); // chat thread round-trips
    expect(restoredComment.authorUserId).toBe(user.id);
    const blob = await storage.read(fileKey);
    expect(blob.toString()).toBe("png-bytes-here"); // uploads restored

    /* the import itself is on the record */
    const log = await db.activityLog.findFirst({ where: { trigger: "backup_import" } });
    expect(log).toBeTruthy();

    await storage.delete(fileKey);
  });

  it("rejects files that are not this system's backup", async () => {
    await expect(importBackup({ hello: "world" }, admin)).rejects.toThrow(/Not a valid backup/);
    await expect(
      importBackup(
        { app: "byteforce-bsystems-sales-platform", version: 999, tables: {} },
        admin,
      ),
    ).rejects.toThrow(/newer version/);
    /* nothing was deleted by the failed attempts */
    await db.user.create({ data: { name: "x", email: "x@x.example", passwordHash: "h" } });
    await expect(importBackup(null, admin)).rejects.toThrow();
    expect(await db.user.count()).toBe(1);
  });
});

/* ADR-063 — the restore runs the marker backfill, and the review caught what
   that costs if it runs blind. `exportBackup` uses `findMany()` with no
   `select`, so a POST-marker export carries `"dueTimeSet": false` EXPLICITLY on
   every date-only row; re-marking those on import would hand a follow-up a
   clock nobody chose — the exact thing ADR-063 exists to prevent. The payload
   can tell the two eras apart (a PRE-marker export has no such key at all), so
   the restore asks before it backfills. */
describe("Restoring never invents a follow-up clock (ADR-063)", () => {
  it("round-trips a date-only follow-up whose instant is NOT 09:00 Cairo", async () => {
    const actor: Actor = { id: null, label: "Backup Admin" };
    const lead = await createLead(
      "bsystems",
      { name: "Clock Corp", number: "0100000009", type: "cold_call" },
      actor,
    );
    /* the seeded shape: 10:00 on the Cairo clock (DST), marked date-only —
       byte-for-byte the instant prisma/seed.ts writes */
    const dayOnly = await db.followUp.create({
      data: {
        leadId: lead.id,
        context: "initial",
        dueAt: new Date("2026-08-20T07:00:00Z"),
        method: "call",
        dueTimeSet: false,
        followingUpWith: "day only",
      },
    });
    const chosen = await db.followUp.create({
      data: {
        leadId: lead.id,
        context: "initial",
        dueAt: new Date("2026-08-20T13:45:00Z"),
        method: "call",
        dueTimeSet: true,
        followingUpWith: "chosen",
      },
    });

    const json = JSON.parse(JSON.stringify(await exportBackup())) as {
      tables: { followUp: Array<Record<string, unknown>> };
    };
    /* the export really does state the false — that is what makes the era
       knowable, and what a blind backfill would overwrite */
    expect(json.tables.followUp.map((r) => r["dueTimeSet"]).sort()).toEqual([false, true]);

    await resetDb();
    await importBackup(json, admin);

    expect((await db.followUp.findUniqueOrThrow({ where: { id: dayOnly.id } })).dueTimeSet).toBe(
      false,
    );
    expect((await db.followUp.findUniqueOrThrow({ where: { id: chosen.id } })).dueTimeSet).toBe(
      true,
    );
  });

  it("still backfills a PRE-marker export, where the key is absent entirely", async () => {
    const now = new Date().toISOString();
    await importBackup(
      {
        app: "byteforce-bsystems-sales-platform",
        version: 1,
        exportedAt: now,
        tables: {
          lead: [
            {
              id: "legacy-lead-1",
              brand: "bsystems",
              name: "Legacy Clock Corp",
              number: "0100000008",
              type: "cold_call",
              stage: "following_up",
              createdAt: now,
              updatedAt: now,
            },
          ],
          followUp: [
            /* no `dueTimeSet` key at all — the pre-ADR-063 shape */
            {
              id: "legacy-fu-chosen",
              leadId: "legacy-lead-1",
              context: "initial",
              dueAt: "2026-08-20T11:30:00Z", // 14:30 Cairo — a time somebody typed
              method: "call",
              createdAt: now,
            },
            {
              id: "legacy-fu-default",
              leadId: "legacy-lead-1",
              context: "initial",
              dueAt: "2026-08-20T06:00:00Z", // 09:00 Cairo — the ADR-061 default
              method: "call",
              createdAt: now,
            },
          ],
        },
      },
      admin,
    );

    const rows = Object.fromEntries(
      (await db.followUp.findMany({ select: { id: true, dueTimeSet: true } })).map((r) => [
        r.id,
        r.dueTimeSet,
      ]),
    );
    expect(rows).toEqual({ "legacy-fu-chosen": true, "legacy-fu-default": false });
  });
});

/* ADR-064 — the third stranding vector, and the reason `Lead.noAnswer` was
   KEPT rather than replaced by the tally: a backup exported before the count
   existed restores flagged leads verbatim, and `createMany` would give them the
   column default (0). A flagged card with a zero tally wears NO marker, so the
   "we tried" the founder recorded would vanish on the way back in. */
describe("Restoring a pre-tally backup keeps the didn't-answer marker (ADR-064)", () => {
  it("a PRE-tally export (no key at all) comes back flagged, at one attempt", async () => {
    const now = new Date().toISOString();
    const lead = (id: string, name: string, noAnswer: boolean) => ({
      id,
      brand: "bsystems",
      name,
      number: "0100000009",
      type: "cold_call",
      stage: "new",
      noAnswer,
      /* no `noAnswerCount` key at all — the pre-ADR-064 shape */
      createdAt: now,
      updatedAt: now,
    });
    await importBackup(
      {
        app: "byteforce-bsystems-sales-platform",
        version: 1,
        exportedAt: now,
        tables: {
          lead: [lead("legacy-flagged", "Legacy Flagged Corp", true), lead("legacy-clear", "Legacy Clear Corp", false)],
        },
      },
      admin,
    );

    const rows = Object.fromEntries(
      (await db.lead.findMany({ select: { id: true, noAnswer: true, noAnswerCount: true } })).map(
        (r) => [r.id, [r.noAnswer, r.noAnswerCount]],
      ),
    );
    expect(rows).toEqual({
      "legacy-flagged": [true, 1], // "it happened" — the honest minimum
      "legacy-clear": [false, 0],
    });
  });

  it("a POST-tally export is restored verbatim — the twin never inflates a real count", async () => {
    const now = new Date().toISOString();
    await importBackup(
      {
        app: "byteforce-bsystems-sales-platform",
        version: 1,
        exportedAt: now,
        tables: {
          lead: [
            {
              id: "modern-lead",
              brand: "bsystems",
              name: "Modern Tally Corp",
              number: "0100000010",
              type: "cold_call",
              stage: "new",
              noAnswer: true,
              noAnswerCount: 5,
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
      },
      admin,
    );
    const back = await db.lead.findUniqueOrThrow({ where: { id: "modern-lead" } });
    expect([back.noAnswer, back.noAnswerCount]).toEqual([true, 5]);
  });
});

/* ADR-057 — the second stranding vector. importBackup does deleteMany +
   createMany with ids preserved and NO transformation, so restoring a backup
   exported BEFORE the agent rename would re-insert agent cards at
   `following_up` / `won` onto a migrated database: invisible cards, exactly
   what the migration exists to prevent — and the admin doing the restore is
   usually recovering from something else already. */
describe("Restoring a pre-rename backup cannot strand a prospect card", () => {
  it("normalises prospect stages, their History and their pending undos on import", async () => {
    const now = new Date().toISOString();
    const payload = {
      app: "byteforce-bsystems-sales-platform",
      version: 1,
      exportedAt: now,
      tables: {
        partnerProspect: [
          {
            id: "old-agent-following",
            kind: "agent",
            name: "Legacy Agent",
            number: "01011112222",
            stage: "following_up",
            address: "1 Old St",
            speciality: "ERP",
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "old-agent-won",
            kind: "agent",
            name: "Legacy Converted Agent",
            number: "01011113333",
            stage: "won",
            converted: true,
            address: "2 Old St",
            speciality: "Networking",
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "old-agent-lead",
            kind: "agent",
            name: "Legacy New Agent",
            number: "01011114444",
            stage: "lead",
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "old-partner-following",
            kind: "partner",
            name: "Hany",
            companyName: "Legacy Trading",
            businessActivity: "Import/export",
            number: "0223456789",
            stage: "following_up",
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "old-partner-won",
            kind: "partner",
            name: "Samir",
            companyName: "Legacy Won Co",
            businessActivity: "Import/export",
            number: "0223456788",
            stage: "won",
            converted: true,
            createdAt: now,
            updatedAt: now,
          },
        ],
        /* the History those cards carry — pre-rename, so it speaks a vocabulary
           the one board no longer has, on BOTH kinds of card */
        activityLog: [
          {
            id: "log-agent-1",
            entityType: "partner_prospect",
            entityId: "old-agent-following",
            actorLabel: "Admin",
            action: "stage_change",
            fromStage: "lead",
            toStage: "following_up",
            trigger: "PP-3",
            createdAt: now,
          },
          {
            id: "log-agent-2",
            entityType: "partner_prospect",
            entityId: "old-agent-won",
            actorLabel: "Admin",
            action: "stage_change",
            fromStage: "following_up",
            toStage: "won",
            trigger: "PP-4",
            createdAt: now,
          },
          {
            id: "log-partner-1",
            entityType: "partner_prospect",
            entityId: "old-partner-won",
            actorLabel: "Admin",
            action: "stage_change",
            fromStage: "following_up",
            toStage: "won",
            trigger: "PP-4",
            createdAt: now,
          },
        ],
        /* and a pending undo the admin never got round to using: its snapshot
           holds a stage the board no longer has, and the entry UNDER it is an
           older action that must not be promoted to the head */
        undoEntry: [
          {
            id: "undo-older",
            userId: "admin-1",
            kind: "prospect_event",
            entityType: "partner_prospect",
            entityId: "old-partner-following",
            label: "Moved Legacy Trading",
            labelAr: "نُقلت",
            fingerprint: now,
            payload: { stage: "lead", noAnswer: false, created: [], updated: [] },
            createdAt: now,
          },
          {
            id: "undo-dead-stage",
            userId: "admin-1",
            kind: "prospect_event",
            entityType: "partner_prospect",
            entityId: "old-agent-won",
            label: "Moved Legacy Converted Agent",
            labelAr: "نُقلت",
            fingerprint: now,
            payload: { stage: "following_up", noAnswer: false, created: [], updated: [] },
            createdAt: now,
          },
          {
            id: "undo-bystander",
            userId: "admin-2",
            kind: "prospect_event",
            entityType: "partner_prospect",
            entityId: "old-partner-following",
            label: "Someone else's move",
            labelAr: "نقل آخر",
            fingerprint: now,
            payload: { stage: "lead", noAnswer: false, created: [], updated: [] },
            createdAt: now,
          },
        ],
      },
    };

    await importBackup(payload, admin);

    const rows = Object.fromEntries(
      (await db.partnerProspect.findMany({ select: { id: true, stage: true } })).map((p) => [
        p.id,
        p.stage,
      ]),
    );
    /* ADR-059 — BOTH kinds walk the two renames now: a restored partner card at
       `following_up` or `won` would render in no column of the one board. */
    expect(rows).toEqual({
      "old-agent-following": "contacted",
      "old-agent-won": "qualified",
      "old-agent-lead": "lead",
      "old-partner-following": "contacted",
      "old-partner-won": "qualified",
    });
    /* the converted flag rides through untouched on both — only the stage moved */
    for (const id of ["old-agent-won", "old-partner-won"]) {
      expect((await db.partnerProspect.findUniqueOrThrow({ where: { id } })).converted).toBe(true);
    }

    /* the History panel speaks the shared vocabulary on every card (ADR-059) */
    const logs = Object.fromEntries(
      (
        await db.activityLog.findMany({
          where: { id: { in: ["log-agent-1", "log-agent-2", "log-partner-1"] } },
          select: { id: true, fromStage: true, toStage: true },
        })
      ).map((l) => [l.id, [l.fromStage, l.toStage]]),
    );
    expect(logs).toEqual({
      "log-agent-1": ["lead", "contacted"],
      "log-agent-2": ["contacted", "qualified"],
      "log-partner-1": ["contacted", "qualified"],
    });

    /* the restored undo offer that could only ever fail is retired, and so is
       the older entry beneath it — ADR-045's honesty invariant survives a
       restore. Another admin's pending entry is not collateral damage. */
    const undos = Object.fromEntries(
      (await db.undoEntry.findMany({ select: { id: true, consumedAt: true } })).map((u) => [
        u.id,
        u.consumedAt !== null,
      ]),
    );
    expect(undos).toEqual({
      "undo-older": true,
      "undo-dead-stage": true,
      "undo-bystander": false,
    });
    expect(await pendingUndoFor("admin-1")).toBeNull();
    expect((await pendingUndoFor("admin-2"))?.id).toBe("undo-bystander");

    /* ADR-062 — this payload predates the TodoDone table (no `todoDone` key):
       it restores cleanly with zero marks, per the `?? []` missing-table rule */
    expect(await db.todoDone.count()).toBe(0);
  });
});

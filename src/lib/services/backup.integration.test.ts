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
  });
});

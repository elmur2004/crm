import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { exportBackup, importBackup } from "./backup";
import { applyLeadEvent, createLead } from "./leads";
import { storage } from "@/lib/storage";
import type { Actor } from "./activity";

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

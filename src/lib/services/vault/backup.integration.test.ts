import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { storage } from "@/lib/storage";
import { exportVault, importVault } from "./backup";
import type { Actor } from "@/lib/services/activity";

/* ADR-054, founder directive B — the vault's module-scoped export/import
   round-trips: rows (ids preserved, relations intact), the vault-owned
   Attachment rows, and the files themselves. Non-vault data is untouched by
   the vault import, and a foreign file is refused. */

const actor: Actor = { id: null, label: "Vault Backup Admin" };

beforeEach(async () => {
  await resetDb();
});

async function seedVault() {
  const employee = await db.vaultEmployee.create({
    data: { name: "Backup Employee", title: "QA", company: "byteforce" },
  });
  const task = await db.vaultTask.create({
    data: {
      employeeId: employee.id,
      name: "Backup task",
      deadline: "2026-01-31",
      status: "completed",
      resultText: "done",
      wasLate: false,
      daysLate: 0,
      completedAt: new Date("2026-01-30T10:00:00Z"),
    },
  });
  const sheet = await db.vaultSheet.create({
    data: {
      company: "bsystems",
      name: "Backup sheet",
      type: "leads",
      storage: "file",
      dateCreated: "2026-01-05",
      recordCount: 3,
    },
  });
  const key = "vaultbackuptest.csv";
  await storage.put(key, Buffer.from("Name,Phone\nA,1\nB,2\nC,3\n"));
  const attachment = await db.attachment.create({
    data: {
      kind: "vault_sheet",
      vaultSheetId: sheet.id,
      filename: "leads.csv",
      storageKey: key,
      mime: "text/csv",
      size: 24,
    },
  });
  const form = await db.vaultForm.create({
    data: { company: "byteforce", name: "Backup form", url: "https://example.com/f" },
  });
  return { employee, task, sheet, attachment, form };
}

describe("vault module backup — export → wipe → import round-trip", () => {
  it("round-trips rows, relations, and files with ids preserved", async () => {
    const seeded = await seedVault();
    const payload = await exportVault(actor);

    expect(payload.app).toContain("vault");
    expect(payload.tables["vaultEmployee"]).toHaveLength(1);
    expect(payload.tables["vaultTask"]).toHaveLength(1);
    expect(payload.tables["attachment"]).toHaveLength(1);
    expect(payload.files).toHaveLength(1);

    /* wipe the vault the destructive way, then restore */
    await db.attachment.deleteMany({});
    await db.vaultTask.deleteMany({});
    await db.vaultSheet.deleteMany({});
    await db.vaultForm.deleteMany({});
    await db.vaultEmployee.deleteMany({});
    await storage.delete(seeded.attachment.storageKey);

    const counts = await importVault(payload, actor);
    expect(counts["vaultEmployee"]).toBe(1);
    expect(counts["attachment"]).toBe(1);

    const task = await db.vaultTask.findUniqueOrThrow({ where: { id: seeded.task.id } });
    expect(task.employeeId).toBe(seeded.employee.id); // relation survived (ids preserved)
    expect(task.wasLate).toBe(false); // frozen verdict survives
    const att = await db.attachment.findUniqueOrThrow({ where: { id: seeded.attachment.id } });
    expect(att.vaultSheetId).toBe(seeded.sheet.id);
    const blob = await storage.read(att.storageKey);
    expect(blob.toString()).toContain("Name,Phone");
  });

  it("REPLACES existing vault data (no merge) and leaves non-vault rows alone", async () => {
    await seedVault();
    const payload = await exportVault(actor);

    /* extra vault rows created after the export must die on import… */
    await db.vaultEmployee.create({ data: { name: "Post-export employee" } });
    /* …while non-vault rows (a user) survive untouched */
    const usersBefore = await db.user.count();

    const counts = await importVault(payload, actor);
    expect(counts["vaultEmployee"]).toBe(1);
    expect(await db.vaultEmployee.count()).toBe(1);
    expect((await db.vaultEmployee.findFirstOrThrow()).name).toBe("Backup Employee");
    expect(await db.user.count()).toBe(usersBefore);
  });

  it("refuses a file that is not a vault export", async () => {
    await expect(importVault({ hello: "world" }, actor)).rejects.toThrow(
      /not a valid vault export/i,
    );
    /* the GLOBAL backup file is a different app marker — refused too */
    await expect(
      importVault(
        { version: 1, app: "byteforce-bsystems-sales-platform", tables: {}, files: [] },
        actor,
      ),
    ).rejects.toThrow(/not a valid vault export/i);
  });
});

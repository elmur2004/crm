import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import type { Actor } from "../activity";
import { pendingUndoFor, performUndo } from "../undo";
import {
  createVaultEmployee,
  listVaultEmployeeCards,
  setVaultEmployeeActive,
  updateVaultEmployee,
  vaultEmployeeSchema,
} from "./employees";
import {
  archiveVaultForm,
  createVaultForm,
  listVaultForms,
  restoreVaultForm,
  updateVaultForm,
  vaultFormSchema,
} from "./forms";
import {
  archiveVaultSheet,
  createVaultSheet,
  getVaultSheet,
  listVaultSheets,
  replaceVaultSheetFile,
  updateVaultSheet,
  vaultSheetSchema,
} from "./sheets";
import {
  archiveVaultDocument,
  createVaultDocument,
  getVaultDocument,
  listVaultDocuments,
  replaceVaultDocumentFile,
  restoreVaultDocument,
  vaultDocumentSchema,
} from "./documents";
import {
  archiveVaultTask,
  completeVaultTask,
  createVaultTask,
  getVaultTask,
  listVaultTasks,
  reopenVaultTask,
  restoreVaultTask,
  saveVaultTaskResult,
  updateVaultTask,
} from "./tasks";
import { searchVault } from "./search";
import { utcToCairo } from "@/lib/datetime";
import { VAULT_COMPANIES } from "./constants";

/* ADR-074 — these tests exercise the SERVICES, not the tenancy wall: they
   pass the whole platform so every assertion here keeps meaning exactly what
   it meant before the wall existed. The wall itself is proved separately, in
   src/lib/module-companies.test.ts and vault-tenancy.integration.test.ts. */
const ALL_COMPANIES = VAULT_COMPANIES;

/* ============================================================================
   ADR-053 — the vault invariants, each proven at the service layer:
   link-XOR-file, the result gate (422), frozen lateness, reopening,
   archive-not-delete + read-only-when-archived, the duplicate-URL handshake,
   append-only activity, undo on the safe mutations only, global search,
   the CSV auto-count and the upgraded content sniffing.
   ========================================================================== */

const actor: Actor = { id: "vault-admin", label: "Admin" };
const other: Actor = { id: "someone-else", label: "Else" };

const ymdToday = () => utcToCairo(new Date()).date;
const ymdShift = (days: number) => utcToCairo(new Date(Date.now() + days * 86_400_000)).date;

const CSV = () =>
  new File([Buffer.from("Name,Phone\nSalma,0100111\nOmar,0122333\n")], "leads.csv", {
    type: "text/csv",
  });
const PDF = () =>
  new File([Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(1024, 7)])], "contract.pdf", {
    type: "application/pdf",
  });
const XLSX = () =>
  new File(
    [
      Buffer.concat([
        Buffer.from("PK"),
        Buffer.from("[Content_Types].xml xl/workbook.xml"),
        Buffer.alloc(256, 2),
      ]),
    ],
    "book.xlsx",
  );

async function makeEmployee(name = "Salma Adel") {
  return createVaultEmployee(
    vaultEmployeeSchema.parse({ name, title: "Media Buyer", company: "byteforce" }),
    actor,
  );
}

async function makeTask(employeeId: string, overrides: Partial<{ deadline: string; name: string }> = {}) {
  return createVaultTask(
    {
      employeeId,
      name: overrides.name ?? "Prepare the campaign report",
      description: null,
      company: "byteforce",
      deadline: overrides.deadline ?? ymdToday(),
    },
    ALL_COMPANIES,
    actor,
  );
}

beforeEach(async () => {
  await resetDb();
});

/* ------------------------------------------------------------------ forms */

describe("vault forms — duplicate-URL handshake + archive-not-delete", () => {
  it("warns (409) on a duplicate URL and files it when acknowledged", async () => {
    await createVaultForm(
      vaultFormSchema.parse({ company: "byteforce", name: "Hiring intake", url: "https://forms.example/a" }),
      ALL_COMPANIES,
      actor,
    );

    /* same URL, no acknowledgement → the 409 handshake names the clash */
    await expect(
      createVaultForm(
        vaultFormSchema.parse({ company: "bsystems", name: "Second copy", url: "https://forms.example/a" }),
        ALL_COMPANIES,
        actor,
      ),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining("Hiring intake") });

    /* acknowledged → both live (duplicates are sometimes legitimate) */
    const second = await createVaultForm(
      vaultFormSchema.parse({
        company: "bsystems",
        name: "Second copy",
        url: "https://forms.example/a",
        acknowledgeDuplicate: true,
      }),
      ALL_COMPANIES,
      actor,
    );
    expect(second.id).toBeTruthy();
    expect(await listVaultForms({ archived: false }, ALL_COMPANIES)).toHaveLength(2);
  });

  it("archived forms leave default lists, stop clashing, and restore intact", async () => {
    const form = await createVaultForm(
      vaultFormSchema.parse({ company: "byteforce", name: "Old form", url: "https://forms.example/x" }),
      ALL_COMPANIES,
      actor,
    );
    await archiveVaultForm(form.id, actor);

    expect(await listVaultForms({ archived: false }, ALL_COMPANIES)).toHaveLength(0);
    const archivedList = await listVaultForms({ archived: true }, ALL_COMPANIES);
    expect(archivedList).toHaveLength(1);
    expect(archivedList[0]!.archivedAt).not.toBeNull();

    /* an archived record is read-only except restore (ADR-043 hardening) */
    await expect(
      updateVaultForm(
        form.id,
        vaultFormSchema.parse({ company: "byteforce", name: "Renamed", url: "https://forms.example/x" }),
        ALL_COMPANIES,
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });

    /* an ARCHIVED duplicate does not block re-filing the same URL */
    const again = await createVaultForm(
      vaultFormSchema.parse({ company: "byteforce", name: "New copy", url: "https://forms.example/x" }),
      ALL_COMPANIES,
      actor,
    );
    expect(again.id).toBeTruthy();

    await restoreVaultForm(form.id, actor);
    const restored = await db.vaultForm.findUnique({ where: { id: form.id } });
    expect(restored).toMatchObject({ archived: false, archivedAt: null, name: "Old form" });
  });

  it("refuses non-http(s) URLs at the boundary (the reference BR-01)", () => {
    expect(() =>
      vaultFormSchema.parse({ company: "byteforce", name: "Bad", url: "notaurl" }),
    ).toThrow();
    expect(() =>
      vaultFormSchema.parse({ company: "byteforce", name: "Bad", url: "ftp://x.example/f" }),
    ).toThrow();
  });
});

/* ----------------------------------------------------------------- sheets */

describe("vault sheets — link XOR file, CSV auto-count, version append", () => {
  it("link mode needs a URL at the boundary; the union makes it unrepresentable", () => {
    expect(() =>
      vaultSheetSchema.parse({
        company: "byteforce",
        name: "Leads June",
        type: "leads",
        storage: "link",
        dateCreated: "2026-06-01",
      }),
    ).toThrow();
  });

  it("BR-03: a manual count without its as-of date is refused", () => {
    expect(() =>
      vaultSheetSchema.parse({
        company: "byteforce",
        name: "Leads June",
        type: "leads",
        storage: "link",
        url: "https://sheets.example/1",
        dateCreated: "2026-06-01",
        recordCount: 120,
      }),
    ).toThrow(/as-of|date/i);
  });

  it("file mode without a file (and link mode WITH one) are refused by the service", async () => {
    const base = {
      company: "byteforce" as const,
      name: "Leads June",
      type: "leads" as const,
      dateCreated: "2026-06-01",
      notes: null,
    };
    await expect(
      createVaultSheet({ ...base, storage: "file" }, null, actor),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      createVaultSheet({ ...base, storage: "link", url: "https://sheets.example/1" }, CSV(), actor),
    ).rejects.toMatchObject({ status: 422 });
    expect(await db.vaultSheet.count()).toBe(0);
    expect(await db.attachment.count()).toBe(0); // no orphaned upload survived
  });

  it("a CSV upload is counted from the file itself, as-of today", async () => {
    const sheet = await createVaultSheet(
      vaultSheetSchema.parse({
        company: "byteforce",
        name: "Campaign leads",
        type: "campaign_leads",
        storage: "file",
        dateCreated: "2026-08-01",
      }),
      CSV(),
      actor,
    );
    expect(sheet.recordCount).toBe(2); // header detected, 2 data rows
    expect(sheet.recordCountAsOf).toBe(ymdToday());

    const detail = await getVaultSheet(sheet.id);
    expect(detail.files).toHaveLength(1);
    expect(detail.files[0]!.kind).toBe("vault_sheet");
  });

  it("replacing the file APPENDS a version (old rows stay) and re-counts", async () => {
    const sheet = await createVaultSheet(
      vaultSheetSchema.parse({
        company: "byteforce",
        name: "Leads master",
        type: "leads",
        storage: "file",
        dateCreated: "2026-08-01",
      }),
      CSV(),
      actor,
    );
    const bigger = new File(
      [Buffer.from("Name,Phone\nA,1\nB,2\nC,3\nD,4\n")],
      "leads-v2.csv",
    );
    const updated = await replaceVaultSheetFile(sheet.id, bigger, actor);
    expect(updated.recordCount).toBe(4);

    const detail = await getVaultSheet(sheet.id);
    expect(detail.files).toHaveLength(2); // predecessor retained — never deleted
    expect(detail.files[0]!.filename).toBe("leads-v2.csv"); // newest first = current

    const log = await db.activityLog.findFirst({
      where: { entityType: "vault_sheet", entityId: sheet.id, action: "replace_file" },
    });
    expect(log).not.toBeNull();
  });

  it("an XLSX stores but keeps the manual-count path; a linked sheet flips to file mode on upload", async () => {
    const sheet = await createVaultSheet(
      vaultSheetSchema.parse({
        company: "bsystems",
        name: "HR roster",
        type: "employees",
        storage: "link",
        url: "https://sheets.example/hr",
        dateCreated: "2026-07-15",
        recordCount: 43,
        recordCountAsOf: "2026-07-15",
      }),
      null,
      actor,
    );
    expect(sheet.recordCount).toBe(43); // manual count with as-of accepted

    const flipped = await replaceVaultSheetFile(sheet.id, XLSX(), actor);
    expect(flipped.storage).toBe("file");
    expect(flipped.url).toBeNull(); // XOR holds after the flip
    expect(flipped.recordCount).toBe(43); // xlsx is not auto-countable — manual kept
    expect((await getVaultSheet(sheet.id)).files).toHaveLength(1);
  });

  it("the upgraded sniff refuses a bare zip renamed .xlsx and a binary .csv", async () => {
    const base = vaultSheetSchema.parse({
      company: "byteforce",
      name: "Evil",
      type: "data",
      storage: "file",
      dateCreated: "2026-08-01",
    });
    const bareZip = new File(
      [Buffer.concat([Buffer.from("PK"), Buffer.alloc(128, 9)])],
      "photos.xlsx",
    );
    await expect(createVaultSheet(base, bareZip, actor)).rejects.toMatchObject({ status: 400 });

    const binaryCsv = new File([Buffer.from([0x00, 0x01, 0x02, 0x61, 0x62])], "data.csv");
    await expect(createVaultSheet(base, binaryCsv, actor)).rejects.toMatchObject({ status: 400 });
    expect(await db.vaultSheet.count()).toBe(0);
  });

  it("filters: type + company + archived views", async () => {
    const a = await createVaultSheet(
      vaultSheetSchema.parse({
        company: "byteforce",
        name: "BF leads",
        type: "leads",
        storage: "link",
        url: "https://s.example/1",
        dateCreated: "2026-08-01",
      }),
      null,
      actor,
    );
    await createVaultSheet(
      vaultSheetSchema.parse({
        company: "bsystems",
        name: "BS data",
        type: "data",
        storage: "link",
        url: "https://s.example/2",
        dateCreated: "2026-08-02",
      }),
      null,
      actor,
    );
    expect(await listVaultSheets({ archived: false }, ALL_COMPANIES)).toHaveLength(2);
    expect(await listVaultSheets({ archived: false, company: "byteforce" }, ALL_COMPANIES)).toHaveLength(1);
    expect(await listVaultSheets({ archived: false, type: "data" }, ALL_COMPANIES)).toHaveLength(1);
    await archiveVaultSheet(a.id, actor);
    expect(await listVaultSheets({ archived: false }, ALL_COMPANIES)).toHaveLength(1);
    expect(await listVaultSheets({ archived: true }, ALL_COMPANIES)).toHaveLength(1);
  });
});

/* -------------------------------------------------------------- documents */

describe("vault documents — required file, version append, archive/restore", () => {
  it("stores the file as an Attachment row and appends on replacement", async () => {
    const doc = await createVaultDocument(
      vaultDocumentSchema.parse({
        company: "byteforce",
        name: "Master services agreement",
        type: "contract",
        description: "signed 2026",
      }),
      PDF(),
      actor,
    );
    const detail = await getVaultDocument(doc.id);
    expect(detail.files).toHaveLength(1);
    expect(detail.files[0]!.mime).toBe("application/pdf");

    await replaceVaultDocumentFile(doc.id, PDF(), actor);
    expect((await getVaultDocument(doc.id)).files).toHaveLength(2);
  });

  it("a wrong-content 'pdf' is refused and leaves no document behind", async () => {
    const notPdf = new File([Buffer.from("just text pretending to be a pdf")], "fake.pdf");
    await expect(
      createVaultDocument(
        vaultDocumentSchema.parse({ company: "bsystems", name: "Fake", type: "other" }),
        notPdf,
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(await db.vaultDocument.count()).toBe(0);
  });

  it("archive removes from the default list; restore brings it back", async () => {
    const doc = await createVaultDocument(
      vaultDocumentSchema.parse({ company: "byteforce", name: "Old deck", type: "presentation" }),
      PDF(),
      actor,
    );
    await archiveVaultDocument(doc.id, actor);
    expect(await listVaultDocuments({ archived: false }, ALL_COMPANIES)).toHaveLength(0);
    await restoreVaultDocument(doc.id, actor);
    expect(await listVaultDocuments({ archived: false }, ALL_COMPANIES)).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ tasks */

describe("vault tasks — THE RESULT GATE", () => {
  it("completing without any result is a 422 and commits NOTHING", async () => {
    const emp = await makeEmployee();
    const task = await makeTask(emp.id);

    await expect(completeVaultTask(task.id, {}, [], actor)).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining("result"),
    });

    const after = await getVaultTask(task.id);
    expect(after.status).toBe("open");
    expect(after.completedAt).toBeNull();
    expect(after.wasLate).toBeNull();
    expect(await db.attachment.count()).toBe(0);
  });

  it("whitespace-only text does not satisfy the gate", async () => {
    const emp = await makeEmployee();
    const task = await makeTask(emp.id);
    await expect(
      completeVaultTask(task.id, { resultText: "   " }, [], actor),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("ANY ONE of text / file / link satisfies the gate", async () => {
    const emp = await makeEmployee();

    const t1 = await makeTask(emp.id, { name: "By text" });
    expect((await completeVaultTask(t1.id, { resultText: "Done, sent by mail" }, [], actor)).status).toBe("completed");

    const t2 = await makeTask(emp.id, { name: "By file" });
    expect((await completeVaultTask(t2.id, {}, [PDF()], actor)).status).toBe("completed");
    expect((await getVaultTask(t2.id)).attachments).toHaveLength(1);

    const t3 = await makeTask(emp.id, { name: "By link" });
    expect(
      (
        await completeVaultTask(
          t3.id,
          { links: [{ url: "https://drive.example/result", label: "The report" }] },
          [],
          actor,
        )
      ).status,
    ).toBe("completed");
    expect((await getVaultTask(t3.id)).links).toHaveLength(1);
  });

  it("a result saved earlier satisfies the gate at completion time", async () => {
    const emp = await makeEmployee();
    const task = await makeTask(emp.id);
    await saveVaultTaskResult(task.id, { resultText: "Half done, notes attached" }, [], actor);
    expect((await getVaultTask(task.id)).status).toBe("open"); // saving never completes
    const done = await completeVaultTask(task.id, {}, [], actor);
    expect(done.status).toBe("completed");
    expect(done.resultText).toContain("Half done");
  });

  it("completing an already-completed task is refused (422)", async () => {
    const emp = await makeEmployee();
    const task = await makeTask(emp.id);
    await completeVaultTask(task.id, { resultText: "done" }, [], actor);
    await expect(completeVaultTask(task.id, { resultText: "again" }, [], actor)).rejects.toMatchObject(
      { status: 422 },
    );
  });
});

describe("vault tasks — lateness frozen at completion", () => {
  it("completing past the deadline stores wasLate/daysLate; on the day = on time", async () => {
    const emp = await makeEmployee();

    const late = await makeTask(emp.id, { deadline: ymdShift(-3), name: "Late one" });
    const doneLate = await completeVaultTask(late.id, { resultText: "finally" }, [], actor);
    expect(doneLate.wasLate).toBe(true);
    expect(doneLate.daysLate).toBe(3);
    expect(doneLate.completedAt).toBeInstanceOf(Date); // server-stamped

    const onTime = await makeTask(emp.id, { deadline: ymdToday(), name: "On time one" });
    const doneOnTime = await completeVaultTask(onTime.id, { resultText: "done" }, [], actor);
    expect(doneOnTime.wasLate).toBe(false);
    expect(doneOnTime.daysLate).toBe(0);
  });

  it("editing the deadline AFTER completion never touches the stored lateness (AC-12)", async () => {
    const emp = await makeEmployee();
    const task = await makeTask(emp.id, { deadline: ymdShift(-2) });
    const done = await completeVaultTask(task.id, { resultText: "done" }, [], actor);
    expect(done).toMatchObject({ wasLate: true, daysLate: 2 });

    /* push the deadline a month into the future — history must not rewrite */
    await updateVaultTask(
      task.id,
      {
        employeeId: emp.id,
        name: task.name,
        description: null,
        company: "byteforce",
        deadline: ymdShift(30),
      },
      ALL_COMPANIES,
      actor,
    );
    const after = await getVaultTask(task.id);
    expect(after.deadline).toBe(ymdShift(30));
    expect(after.wasLate).toBe(true); // frozen
    expect(after.daysLate).toBe(2); // frozen
    expect(after.completedAt?.getTime()).toBe(done.completedAt!.getTime());
  });

  it("the LIVE overdue flag is distinct from the frozen record", async () => {
    const emp = await makeEmployee();
    await makeTask(emp.id, { deadline: ymdShift(-1), name: "Overdue open" });
    await makeTask(emp.id, { deadline: ymdShift(1), name: "Future open" });
    const rows = await listVaultTasks({ archived: false }, ALL_COMPANIES);
    expect(rows.find((t) => t.name === "Overdue open")!.isOverdue).toBe(true);
    expect(rows.find((t) => t.name === "Future open")!.isOverdue).toBe(false);
    expect(rows.filter((t) => t.isOverdue)).toHaveLength(
      (await listVaultTasks({ archived: false, overdue: true }, ALL_COMPANIES)).length,
    );
  });
});

describe("vault tasks — reopening", () => {
  it("clears the completion trio, KEEPS the result, and logs the erased values", async () => {
    const emp = await makeEmployee();
    const task = await makeTask(emp.id, { deadline: ymdShift(-1) });
    await completeVaultTask(
      task.id,
      { resultText: "the record", links: [{ url: "https://x.example/r", label: null }] },
      [PDF()],
      actor,
    );

    const reopened = await reopenVaultTask(task.id, actor);
    expect(reopened.status).toBe("open");
    expect(reopened.completedAt).toBeNull();
    expect(reopened.wasLate).toBeNull();
    expect(reopened.daysLate).toBeNull();

    const detail = await getVaultTask(task.id);
    expect(detail.resultText).toBe("the record"); // result survives (§9.5)
    expect(detail.attachments).toHaveLength(1);
    expect(detail.links).toHaveLength(1);

    const log = await db.activityLog.findFirst({
      where: { entityType: "vault_task", entityId: task.id, action: "reopen" },
    });
    expect(log?.trigger).toContain("late by 1"); // provenance of the erased record
  });

  it("reopening an open task is refused", async () => {
    const emp = await makeEmployee();
    const task = await makeTask(emp.id);
    await expect(reopenVaultTask(task.id, actor)).rejects.toMatchObject({ status: 422 });
  });

  it("an archived task can be neither completed nor reopened", async () => {
    const emp = await makeEmployee();
    const task = await makeTask(emp.id);
    await archiveVaultTask(task.id, actor);
    await expect(
      completeVaultTask(task.id, { resultText: "x" }, [], actor),
    ).rejects.toMatchObject({ status: 400 });
    await restoreVaultTask(task.id, actor);
    expect((await getVaultTask(task.id)).archived).toBe(false);
  });
});

/* -------------------------------------------------------------- employees */

describe("vault employees — cards, counts, deactivate-not-delete", () => {
  it("cards carry open / overdue / completed counts (archived tasks excluded)", async () => {
    const emp = await makeEmployee("Omar Nabil");
    await makeTask(emp.id, { deadline: ymdShift(1), name: "future" });
    await makeTask(emp.id, { deadline: ymdShift(-2), name: "overdue" });
    const done = await makeTask(emp.id, { deadline: ymdToday(), name: "done" });
    await completeVaultTask(done.id, { resultText: "ok" }, [], actor);
    const hidden = await makeTask(emp.id, { deadline: ymdShift(-9), name: "archived away" });
    await archiveVaultTask(hidden.id, actor);

    const cards = await listVaultEmployeeCards(ALL_COMPANIES);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      name: "Omar Nabil",
      openCount: 2,
      overdueCount: 1,
      completedCount: 1,
    });
  });

  it("a deactivated card takes no new tasks but keeps its history", async () => {
    const emp = await makeEmployee("Leaving Soon");
    const task = await makeTask(emp.id, { deadline: ymdShift(-1) });
    await completeVaultTask(task.id, { resultText: "done late" }, [], actor);

    await setVaultEmployeeActive(emp.id, false, actor);
    await expect(makeTask(emp.id)).rejects.toMatchObject({ status: 400 });

    expect(await listVaultEmployeeCards(ALL_COMPANIES)).toHaveLength(0); // active cards only
    const all = await listVaultEmployeeCards(ALL_COMPANIES, { includeInactive: true });
    expect(all[0]).toMatchObject({ active: false, completedCount: 1 }); // frozen history stays

    await updateVaultEmployee(
      emp.id,
      vaultEmployeeSchema.parse({ name: "Leaving Soon", title: "Ex", company: null }),
      actor,
    );
    expect((await db.vaultEmployee.findUnique({ where: { id: emp.id } }))?.company).toBeNull();
  });
});

/* ----------------------------------------------------- activity + undo */

describe("vault activity log — append-only provenance on every mutation", () => {
  it("create/complete/archive/restore each leave their own entry", async () => {
    const emp = await makeEmployee();
    const task = await makeTask(emp.id);
    await completeVaultTask(task.id, { resultText: "done" }, [], actor);
    await archiveVaultTask(task.id, actor);
    await restoreVaultTask(task.id, actor);

    const entries = await db.activityLog.findMany({
      where: { entityType: "vault_task", entityId: task.id },
      orderBy: { createdAt: "asc" },
    });
    expect(entries.map((e) => e.action)).toEqual([
      "create",
      "complete",
      "archive",
      "restore",
    ]);
    const complete = entries.find((e) => e.action === "complete")!;
    expect(complete.fromStage).toBe("open");
    expect(complete.toStage).toBe("completed");
    expect(complete.actorLabel).toBe("Admin");
  });
});

describe("vault undo — archive/restore are the safe, undoable mutations", () => {
  it("archiving offers an undo that puts the record back exactly", async () => {
    const form = await createVaultForm(
      vaultFormSchema.parse({ company: "byteforce", name: "Undo me", url: "https://u.example/f" }),
      ALL_COMPANIES,
      actor,
    );
    await archiveVaultForm(form.id, actor);

    const pending = await pendingUndoFor(actor.id!);
    expect(pending?.label).toContain("Undo me");

    const undone = await performUndo(actor);
    expect(undone.label).toContain("Undo me");
    const fresh = await db.vaultForm.findUnique({ where: { id: form.id } });
    expect(fresh).toMatchObject({ archived: false, archivedAt: null });
  });

  it("undo is personal and refuses a changed record", async () => {
    const form = await createVaultForm(
      vaultFormSchema.parse({ company: "byteforce", name: "Mine", url: "https://u.example/g" }),
      ALL_COMPANIES,
      actor,
    );
    await archiveVaultForm(form.id, actor);
    await expect(performUndo(other)).rejects.toMatchObject({ status: 400 }); // not their action

    /* the record moved on (restored by hand) — the fingerprint refuses */
    await restoreVaultForm(form.id, actor);
    await archiveVaultForm(form.id, actor);
    await db.vaultForm.update({ where: { id: form.id }, data: { name: "Renamed since" } });
    await expect(performUndo(actor)).rejects.toMatchObject({ status: 409 });
  });

  it("task completion INVALIDATES pending undo (it freezes a lateness record)", async () => {
    const emp = await makeEmployee();
    const task = await makeTask(emp.id, { name: "Seals undo" });
    const decoy = await makeTask(emp.id, { name: "Archived first" });
    await archiveVaultTask(decoy.id, actor);
    expect(await pendingUndoFor(actor.id!)).not.toBeNull();

    await completeVaultTask(task.id, { resultText: "done" }, [], actor);
    expect(await pendingUndoFor(actor.id!)).toBeNull(); // the button offers nothing stale
  });
});

/* ----------------------------------------------------------------- search */

describe("vault global search", () => {
  it("finds across all four kinds, skips archived, needs 2+ characters", async () => {
    const emp = await makeEmployee();
    await createVaultForm(
      vaultFormSchema.parse({ company: "byteforce", name: "Ramadan campaign form", url: "https://s.example/f" }),
      ALL_COMPANIES,
      actor,
    );
    await createVaultSheet(
      vaultSheetSchema.parse({
        company: "byteforce",
        name: "Ramadan leads sheet",
        type: "leads",
        storage: "link",
        url: "https://s.example/s",
        dateCreated: "2026-08-01",
      }),
      null,
      actor,
    );
    await createVaultDocument(
      vaultDocumentSchema.parse({ company: "byteforce", name: "Ramadan brief", type: "report" }),
      PDF(),
      actor,
    );
    await makeTask(emp.id, { name: "Ramadan launch checklist" });
    const gone = await createVaultForm(
      vaultFormSchema.parse({ company: "byteforce", name: "Ramadan archived form", url: "https://s.example/g" }),
      ALL_COMPANIES,
      actor,
    );
    await archiveVaultForm(gone.id, actor);

    const results = await searchVault("ramadan", ALL_COMPANIES);
    expect(results.total).toBe(4);
    expect(results.groups.forms).toHaveLength(1); // the archived one never surfaces
    expect(results.groups.sheets).toHaveLength(1);
    expect(results.groups.documents).toHaveLength(1);
    expect(results.groups.tasks[0]!.subtitle).toBe("Salma Adel");

    expect((await searchVault("r", ALL_COMPANIES)).total).toBe(0);
  });
});

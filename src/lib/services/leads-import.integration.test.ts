import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* ============================================================================
   IMPORT LEADS FROM EXCEL — against the real database, through the real routes.

   Everything is REAL except the session (and the locale cookie jar, which has
   no request scope under vitest): the four route modules, the guards, the
   create path, Postgres, and real .xlsx bytes. Mocked by module path exactly as
   leads-export-wall.integration.test.ts does.
   ========================================================================== */

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn<() => Promise<{ user?: { id: string; impersonatorId?: string } } | null>>(),
}));
vi.mock("@/lib/auth/index", () => ({ auth: authMock }));

const { localeCookie } = vi.hoisted(() => ({ localeCookie: { value: "en" } }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "locale" ? { value: localeCookie.value } : undefined),
  }),
}));

import readExcelFile from "read-excel-file/node";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { importFile, row, type FixtureCell } from "@/tests/leads-import-file";
import { ROLES, type Role } from "@/lib/pipeline-engine/constants";
import { startOfCairoDay } from "@/lib/datetime";
import {
  LEAD_CREATE_ROLES,
  MAX_IMPORT_ROWS,
  canImportLeads,
  type ImportFileErrorBody,
  type ImportResultBody,
} from "@/lib/crm/leads-import";
import { createLead } from "./leads";
import { listBsLeads } from "./bsystems-admin";
import { countUnassigned } from "./sales-reps";
import { pendingUndoFor } from "./undo";
import { POST as bsImport } from "@/app/api/b-systems/leads/import/route";
import { POST as bfImport } from "@/app/api/byteforce/leads/import/route";
import { GET as bsTemplate } from "@/app/api/b-systems/leads/import/template/route";
import { GET as bfTemplate } from "@/app/api/byteforce/leads/import/template/route";
import { POST as bsCreate } from "@/app/api/b-systems/leads/route";
import { POST as bfCreate } from "@/app/api/byteforce/leads/route";

type Company = "bsystems" | "byteforce";

const IMPORT: Record<Company, (req: Request) => Promise<Response>> = { bsystems: bsImport, byteforce: bfImport };
const TEMPLATE: Record<Company, (req: Request) => Promise<Response>> = { bsystems: bsTemplate, byteforce: bfTemplate };
const BASE: Record<Company, string> = {
  bsystems: "http://localhost/api/b-systems",
  byteforce: "http://localhost/api/byteforce",
};

let seq = 0;
async function makeUser(name: string, roles: Role[]) {
  seq += 1;
  return db.user.create({
    data: {
      name,
      phone: `+2010888${String(seq).padStart(5, "0")}`,
      passwordHash: "x",
      roles: { create: roles.map((role) => ({ role })) },
    },
  });
}

function signIn(user: { id: string } | null) {
  authMock.mockResolvedValue(user ? { user: { id: user.id } } : null);
}

/** Upload a file through the REAL import route, signed in as `user`. */
async function upload(company: Company, user: { id: string } | null, buf: Buffer | null, filename = "leads.xlsx") {
  signIn(user);
  const form = new FormData();
  if (buf) form.append("file", new File([new Uint8Array(buf)], filename, { type: "application/octet-stream" }));
  const res = await IMPORT[company](new Request(`${BASE[company]}/leads/import`, { method: "POST", body: form }));
  const body = (await res.json().catch(() => ({}))) as ImportResultBody & ImportFileErrorBody;
  return { status: res.status, body };
}

const leadCount = (brand: Company) => db.lead.count({ where: { brand } });

beforeEach(async () => {
  await resetDb();
  authMock.mockReset();
  localeCookie.value = "en";
});

/* ------------------------------------------------------------------------ */

describe("a MIXED file imports exactly the valid rows", () => {
  it("creates the good rows, skips the rest with their row numbers and reasons, and touches nothing else", async () => {
    const admin = await makeUser("Founder", ["bsystems_admin"]);
    /* an existing B-Systems lead — the duplicate target */
    const existing = await createLead(
      "bsystems",
      { name: "Ahmed Existing", number: "010 1111 1111", type: "event_data", companyName: "Old Co", email: "ahmed@old.co" },
      { id: admin.id, label: admin.name },
      { ownerType: "admin", ownerUserId: admin.id },
    );
    /* a ByteForce lead: the SAME number in the other company is not a duplicate here */
    await createLead("byteforce", { name: "BF Lead", number: "01022222222", type: "cold_call" }, { id: null, label: "Seed" });
    const before = await db.lead.findUniqueOrThrow({ where: { id: existing.id } });

    const startedAt = new Date();
    const buf = await importFile("bsystems", [
      row("Mona Adel", "01012345678", "Event data", { email: "mona@acme.com" }), // 2 ✓
      row("Ahmed Again", "+20 101 111 1111"), // 3 duplicate in the system
      row("Zero Lost", 1033333333), // 4 ✓ (numeric — zero put back)
      row("Mona Twice", "010-1234-5678"), // 5 duplicate of row 2
      row("", "01044444444"), // 6 missing name
      row("Odd Type", "01055555555", "Walk in"), // 7 unknown type
      row("Landline", 221000001), // 8 numeric, not a mobile — refused
      row("Cross Company", "01022222222"), // 9 ✓ (ByteForce's number)
      row("Backdated", "01066666666", "Cold call", { createdAt: "15/03/2024" }), // 10 ✓
      row("From The Future", "01077777777", "Cold call", { createdAt: "01/01/2099" }), // 11 future
    ]);
    const { status, body } = await upload("bsystems", admin, buf);
    const finishedAt = new Date();
    expect(status).toBe(200);

    expect(body.imported).toBe(4);
    expect(body.skipped.map((s) => [s.row, s.reasons.map((r) => r.code)])).toEqual([
      [3, ["duplicateInSystem"]],
      [5, ["duplicateInFile"]],
      [6, ["missingName"]],
      [7, ["unknownType"]],
      [8, ["numberStoredAsNumber"]],
      [11, ["futureDate"]],
    ]);
    expect(body.skipped[0]!.reasons[0]).toEqual({ code: "duplicateInSystem", existingName: "Ahmed Existing" });
    expect(body.skipped[1]!.reasons[0]).toEqual({ code: "duplicateInFile", firstRow: 2 });
    expect(body.restored).toEqual([{ row: 4, from: "1033333333", to: "01033333333" }]);

    /* exactly the four, with their numbers as they must be stored */
    const imported = await db.lead.findMany({
      where: { brand: "bsystems", id: { not: existing.id } },
      orderBy: { name: "asc" },
    });
    expect(imported.map((l) => [l.name, l.number])).toEqual([
      ["Backdated", "01066666666"],
      ["Cross Company", "01022222222"],
      ["Mona Adel", "01012345678"],
      ["Zero Lost", "01033333333"],
    ]);
    expect(await leadCount("byteforce")).toBe(1);

    /* THE EXISTING LEAD IS UNCHANGED — the whole row, not one column */
    expect(await db.lead.findUniqueOrThrow({ where: { id: existing.id } })).toEqual(before);

    /* the skipped rows came back as a re-importable file */
    expect(body.skippedFile!.filename).toMatch(/^b-systems-leads-skipped-\d{4}-\d{2}-\d{2}\.xlsx$/);
    const [skippedSheet] = await readExcelFile(Buffer.from(body.skippedFile!.base64, "base64"));
    expect(skippedSheet!.sheet).toBe("B-Systems leads");
    expect(skippedSheet!.data).toHaveLength(1 + 6);

    void startedAt;
    void finishedAt;
  });

  it("imported leads are UNASSIGNED, stamped with who imported them, and each has its ActivityLog row", async () => {
    const admin = await makeUser("Founder", ["bsystems_admin"]);
    const before = new Date();
    const { status } = await upload(
      "bsystems",
      admin,
      await importFile("bsystems", [row("One", "01011111111"), row("Two", "01022222222")]),
    );
    expect(status).toBe(200);
    const leads = await db.lead.findMany({ where: { brand: "bsystems" } });
    expect(leads).toHaveLength(2);
    for (const lead of leads) {
      /* ADR-051's unassigned state: internal bucket, no owner account, no rep */
      expect(lead.ownerType).toBe("internal");
      expect(lead.ownerUserId).toBeNull();
      expect(lead.salesRepId).toBeNull();
      expect(lead.createdByUserId).toBe(admin.id);
      expect(lead.stage).toBe("new");
      expect(lead.source).toBe("direct");
      expect(lead.partnerId).toBeNull();
      expect(lead.archived).toBe(false);

      const logs = await db.activityLog.findMany({ where: { entityType: "lead", entityId: lead.id } });
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        action: "create",
        trigger: "leads_import",
        toStage: "new",
        actorId: admin.id,
        actorLabel: "Founder",
      });
      expect(logs[0]!.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    }
    /* and they sit in the queue an admin already looks in: Owner → Unassigned */
    const queue = await listBsLeads("bsystems", "unassigned");
    expect(queue.map((l) => l.name).sort()).toEqual(["One", "Two"]);
  });

  it("ByteForce: the leads land with no sales rep — the Unassigned card", async () => {
    const staff = await makeUser("Sara", ["byteforce_staff"]);
    expect(await countUnassigned("byteforce")).toBe(0);
    const { status, body } = await upload(
      "byteforce",
      staff,
      await importFile("byteforce", [row("Walk In", "01011111111", "Organic", { company: "" })]),
    );
    expect(status).toBe(200);
    expect(body.imported).toBe(1);
    const lead = await db.lead.findFirstOrThrow({ where: { brand: "byteforce" } });
    expect(lead.salesRepId).toBeNull();
    expect(lead.companyName).toBeNull();
    expect(lead.createdByUserId).toBe(staff.id);
    expect(await countUnassigned("byteforce")).toBe(1);
  });
});

/* ------------------------------------------------------------------------ */

describe("the CREATED DATE — the lead's age is historical, the import's moment is not", () => {
  it("a backdated row lands on its Cairo day; a blank one is dated now; the History row says NOW", async () => {
    const admin = await makeUser("Founder", ["bsystems_admin"]);
    const before = new Date();
    const { status } = await upload(
      "bsystems",
      admin,
      await importFile("bsystems", [
        row("Old Friend", "01011111111", "Cold call", { createdAt: "15/03/2024" }),
        row("As Date Cell", "01022222222", "Cold call", { createdAt: new Date("2025-06-01T00:00:00.000Z") }),
        row("As Serial", "01033333333", "Cold call", { createdAt: 45366 }),
        row("Brand New", "01044444444"),
      ]),
    );
    const after = new Date();
    expect(status).toBe(200);
    const byName = Object.fromEntries((await db.lead.findMany({ where: { brand: "bsystems" } })).map((l) => [l.name, l]));

    expect(byName["Old Friend"]!.createdAt.toISOString()).toBe(startOfCairoDay("2024-03-15").toISOString());
    expect(byName["As Date Cell"]!.createdAt.toISOString()).toBe(startOfCairoDay("2025-06-01").toISOString());
    expect(byName["As Serial"]!.createdAt.toISOString()).toBe(startOfCairoDay("2024-03-15").toISOString());
    /* blank → the moment of the import, as every lead has always been dated */
    const blank = byName["Brand New"]!.createdAt.getTime();
    expect(blank).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(blank).toBeLessThanOrEqual(after.getTime() + 1000);

    /* THE HISTORY ROW CARRIES THE REAL IMPORT TIME — not March 2024 */
    const log = await db.activityLog.findFirstOrThrow({
      where: { entityType: "lead", entityId: byName["Old Friend"]!.id },
    });
    expect(log.trigger).toBe("leads_import");
    expect(log.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(log.createdAt.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
    /* and "last activity" is the import too — the record was touched today */
    expect(byName["Old Friend"]!.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
  });

  it("a future date, an impossible one and a pre-2000 one are each SKIPPED with a reason — never clamped", async () => {
    const admin = await makeUser("Founder", ["bsystems_admin"]);
    const { body } = await upload(
      "bsystems",
      admin,
      await importFile("bsystems", [
        row("Future", "01011111111", "Cold call", { createdAt: "01/01/2099" }),
        row("Impossible", "01022222222", "Cold call", { createdAt: "31/02/2024" }),
        row("Ancient", "01033333333", "Cold call", { createdAt: "31/12/1999" }),
      ]),
    );
    expect(body.imported).toBe(0);
    expect(body.skipped.map((s) => s.reasons)).toEqual([
      [{ code: "futureDate", date: "2099-01-01" }],
      [{ code: "invalidDate", value: "31/02/2024" }],
      [{ code: "tooOldDate", date: "1999-12-31" }],
    ]);
    expect(await leadCount("bsystems")).toBe(0);
  });
});

/* ------------------------------------------------------------------------ */

describe("the wall", () => {
  const tiny = (company: Company) => importFile(company, [row(`Wall ${company}`, "01099999999")]);

  it("every role × every company: the server admits exactly canImportLeads", async () => {
    for (const role of ROLES) {
      const user = await makeUser(`A ${role}`, [role]);
      for (const company of ["bsystems", "byteforce"] as Company[]) {
        const { status } = await upload(company, user, await tiny(company));
        expect(status, `${role} → ${company}`).toBe(canImportLeads([role], company) ? 200 : 403);
      }
    }
  });

  it("the roles that may ADD a B-Systems lead but not open its Leads page are refused, and nothing is written", async () => {
    for (const role of ["bsystems_sales", "bsystems_agent", "bsystems_partner", "bsystems_data_entry"] as Role[]) {
      const user = await makeUser(`No ${role}`, [role]);
      const { status, body } = await upload("bsystems", user, await tiny("bsystems"));
      expect(status, role).toBe(403);
      expect(body.error).toBe("You do not have access to this area");
    }
    expect(await leadCount("bsystems")).toBe(0);
  });

  it("an anonymous caller is 401 on both, before the file is read", async () => {
    expect((await upload("bsystems", null, await tiny("bsystems"))).status).toBe(401);
    expect((await upload("byteforce", null, await tiny("byteforce"))).status).toBe(401);
    expect(await db.lead.count()).toBe(0);
  });

  it("THE WRONG COMPANY cannot be imported into — by role, and by file", async () => {
    const bfOnly = await makeUser("ByteForce only", ["byteforce_staff"]);
    const bsOnly = await makeUser("B-Systems only", ["bsystems_admin"]);
    expect((await upload("bsystems", bfOnly, await tiny("bsystems"))).status).toBe(403);
    expect((await upload("byteforce", bsOnly, await tiny("byteforce"))).status).toBe(403);
    expect(await db.lead.count()).toBe(0);

    /* the founder holds both — and a ByteForce file on the B-Systems page is
       still refused, naming both companies */
    const founder = await makeUser("Founder", ["bsystems_admin", "byteforce_staff"]);
    const wrong = await upload("bsystems", founder, await tiny("byteforce"));
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe("wrong_company");
    expect(wrong.body.otherCompany).toBe("byteforce");
    expect(await db.lead.count()).toBe(0);

    /* and a ?company= on the URL changes nothing — the route is the company */
    signIn(founder);
    const form = new FormData();
    form.append("file", new File([new Uint8Array(await tiny("bsystems"))], "x.xlsx"));
    const res = await bsImport(
      new Request("http://localhost/api/b-systems/leads/import?company=byteforce", { method: "POST", body: form }),
    );
    expect(res.status).toBe(200);
    expect(await leadCount("bsystems")).toBe(1);
    expect(await leadCount("byteforce")).toBe(0);
  });

  it("the template: permitted callers get the .xlsx, everyone else is refused", async () => {
    const admin = await makeUser("Admin", ["bsystems_admin"]);
    const sales = await makeUser("Sales", ["bsystems_sales"]);
    signIn(admin);
    const ok = await TEMPLATE.bsystems(new Request(`${BASE.bsystems}/leads/import/template`));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("Content-Type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(ok.headers.get("Content-Disposition")).toBe('attachment; filename="b-systems-leads-import-template.xlsx"');
    expect(Buffer.from(await ok.arrayBuffer()).subarray(0, 2).toString("latin1")).toBe("PK");
    signIn(sales);
    expect((await TEMPLATE.bsystems(new Request(`${BASE.bsystems}/leads/import/template`))).status).toBe(403);
    signIn(admin);
    expect((await TEMPLATE.byteforce(new Request(`${BASE.byteforce}/leads/import/template`))).status).toBe(403);
    signIn(null);
    expect((await TEMPLATE.byteforce(new Request(`${BASE.byteforce}/leads/import/template`))).status).toBe(401);
  });

  it("LEAD_CREATE_ROLES is what the REAL create routes accept, role by role", async () => {
    const CREATE = { bsystems: bsCreate, byteforce: bfCreate };
    for (const role of ROLES) {
      const user = await makeUser(`Creator ${role}`, [role]);
      for (const company of ["bsystems", "byteforce"] as Company[]) {
        signIn(user);
        const res = await CREATE[company](
          new Request(`${BASE[company]}/leads`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Probe", number: "01000000001", type: "cold_call", companyName: "Probe Co" }),
          }),
        );
        expect(res.status === 201, `${role} creating in ${company}`).toBe(
          LEAD_CREATE_ROLES[company].includes(role),
        );
      }
    }
  });

  it("all four route files are wiring only — one shared handler, the company hardcoded", () => {
    const read = (rel: string) => readFileSync(path.resolve(process.cwd(), rel), "utf8");
    const files: Array<[string, string]> = [
      ["src/app/api/b-systems/leads/import/route.ts", 'leadsImportRoute("bsystems")'],
      ["src/app/api/byteforce/leads/import/route.ts", 'leadsImportRoute("byteforce")'],
      ["src/app/api/b-systems/leads/import/template/route.ts", 'leadsImportTemplateRoute("bsystems")'],
      ["src/app/api/byteforce/leads/import/template/route.ts", 'leadsImportTemplateRoute("byteforce")'],
    ];
    for (const [file, call] of files) {
      const src = read(file);
      expect(src, file).toContain(call);
      expect(src, file).not.toMatch(/requireRole|requireBsAdmin|requireBrandStaff|searchParams|db\./);
    }
    const shared = read("src/lib/api/leads-import-route.ts");
    expect(shared).toContain("canImportLeads");
    expect(shared).toContain("requireUser");
    expect(shared).not.toContain("searchParams");
    expect(shared).not.toContain("new URL(");
  });
});

/* ------------------------------------------------------------------------ */

describe("a file that cannot be imported is refused WHOLE, and nothing is written", () => {
  it("not the template", async () => {
    const admin = await makeUser("Admin", ["bsystems_admin"]);
    const buf = await importFile("bsystems", [["A", "01011111111"]], { header: ["Customer", "Phone"], sheet: "Sheet1" });
    const { status, body } = await upload("bsystems", admin, buf);
    expect(status).toBe(400);
    expect(body.code).toBe("wrong_template");
    expect(body.unexpected).toEqual(["Customer", "Phone"]);
    expect(await db.lead.count()).toBe(0);
  });

  it(`more than ${MAX_IMPORT_ROWS} rows`, async () => {
    const admin = await makeUser("Admin", ["bsystems_admin"]);
    const rows: FixtureCell[][] = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) =>
      row(`L${i}`, `0101${String(i).padStart(7, "0")}`),
    );
    const { status, body } = await upload("bsystems", admin, await importFile("bsystems", rows));
    expect(status).toBe(413);
    expect(body.code).toBe("too_many_rows");
    expect(body.rows).toBe(MAX_IMPORT_ROWS + 1);
    expect(await db.lead.count()).toBe(0);
  });

  it("not an .xlsx, and no file at all", async () => {
    const admin = await makeUser("Admin", ["bsystems_admin"]);
    const xlsx = await importFile("bsystems", [row("A", "01011111111")]);
    expect((await upload("bsystems", admin, xlsx, "leads.csv")).body.code).toBe("not_xlsx");
    expect((await upload("bsystems", admin, Buffer.from("Name,Number"), "leads.xlsx")).body.code).toBe("not_xlsx");
    const none = await upload("bsystems", admin, null);
    expect(none.status).toBe(400);
    expect(none.body.code).toBe("no_file");
    expect(await db.lead.count()).toBe(0);
  });

  it("ATOMIC: a database failure on row 4 leaves NOTHING imported, and says so", async () => {
    const admin = await makeUser("Admin", ["bsystems_admin"]);
    /* a real Postgres failure part-way through the inserts */
    await db.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION test_import_boom() RETURNS trigger AS $$
      BEGIN
        IF NEW.name = 'BOOM' THEN RAISE EXCEPTION 'injected failure'; END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql`);
    await db.$executeRawUnsafe(
      `CREATE TRIGGER test_import_boom BEFORE INSERT ON "Lead" FOR EACH ROW EXECUTE FUNCTION test_import_boom()`,
    );
    try {
      const silence = vi.spyOn(console, "error").mockImplementation(() => {});
      const { status, body } = await upload(
        "bsystems",
        admin,
        await importFile("bsystems", [
          row("First", "01011111111"),
          row("Second", "01022222222"),
          row("BOOM", "01033333333"),
          row("Fourth", "01044444444"),
        ]),
      );
      silence.mockRestore();
      expect(status).toBe(500);
      expect(body.code).toBe("failed");
      expect(body.error).toBe("The import stopped and nothing was imported — no lead was created. Try again.");
      expect(await db.lead.count()).toBe(0);
      expect(await db.activityLog.count({ where: { trigger: "leads_import" } })).toBe(0);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS test_import_boom ON "Lead"`);
      await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS test_import_boom()`);
    }
    /* and the same file imports cleanly once the failure is gone */
    const retry = await upload(
      "bsystems",
      admin,
      await importFile("bsystems", [row("First", "01011111111"), row("Second", "01022222222")]),
    );
    expect(retry.body.imported).toBe(2);
  });
});

/* ------------------------------------------------------------------------ */

describe("re-running, racing, undo and scale", () => {
  it("importing the same file twice creates each lead once — the second run skips them all", async () => {
    const admin = await makeUser("Admin", ["bsystems_admin"]);
    const buf = await importFile("bsystems", [row("A", "01011111111"), row("B", "01022222222")]);
    expect((await upload("bsystems", admin, buf)).body.imported).toBe(2);
    const again = await upload("bsystems", admin, buf);
    expect(again.body.imported).toBe(0);
    expect(again.body.skipped.map((s) => s.reasons[0]!.code)).toEqual(["duplicateInSystem", "duplicateInSystem"]);
    expect(await leadCount("bsystems")).toBe(2);
  });

  it("two imports of the same file AT ONCE still create each lead once (the per-company lock)", async () => {
    const admin = await makeUser("Admin", ["bsystems_admin"]);
    signIn(admin);
    const buf = await importFile("bsystems", [row("A", "01011111111"), row("B", "01022222222"), row("C", "01033333333")]);
    const send = () => {
      const form = new FormData();
      form.append("file", new File([new Uint8Array(buf)], "leads.xlsx"));
      return bsImport(new Request(`${BASE.bsystems}/leads/import`, { method: "POST", body: form }));
    };
    const [one, two] = await Promise.all([send(), send()]);
    const a = (await one.json()) as ImportResultBody;
    const b = (await two.json()) as ImportResultBody;
    expect(a.imported + b.imported).toBe(3);
    expect(await leadCount("bsystems")).toBe(3);
  });

  it("an import is not undoable, so the one-step Undo stops offering the action before it", async () => {
    const admin = await makeUser("Admin", ["bsystems_admin"]);
    await createLead("bsystems", { name: "Typed By Hand", number: "01099999999", type: "cold_call", companyName: "X" }, { id: admin.id, label: admin.name });
    expect((await pendingUndoFor(admin.id))?.label).toContain("Typed By Hand");
    await upload("bsystems", admin, await importFile("bsystems", [row("Imported", "01011111111")]));
    expect(await pendingUndoFor(admin.id)).toBeNull();
    /* and no per-lead undo entry was written for the imported row */
    expect(await db.undoEntry.count({ where: { userId: admin.id, consumedAt: null } })).toBe(0);
  });

  it(`imports ${MAX_IMPORT_ROWS} rows in one transaction, inside the time limit`, async () => {
    const admin = await makeUser("Admin", ["bsystems_admin"]);
    const rows: FixtureCell[][] = Array.from({ length: MAX_IMPORT_ROWS }, (_, i) =>
      row(`Bulk ${i}`, `0101${String(i).padStart(7, "0")}`, "Campaign lead", { email: `bulk${i}@x.com` }),
    );
    const buf = await importFile("bsystems", rows);
    const t0 = Date.now();
    const { status, body } = await upload("bsystems", admin, buf);
    const ms = Date.now() - t0;
    /* stderr, because vitest swallows console.log from a passing test */
    process.stderr.write(`[leads-import] ${MAX_IMPORT_ROWS} rows, ${buf.length} bytes → ${ms} ms${"\n"}`);
    expect(status).toBe(200);
    expect(body.imported).toBe(MAX_IMPORT_ROWS);
    expect(await leadCount("bsystems")).toBe(MAX_IMPORT_ROWS);
    expect(await db.activityLog.count({ where: { trigger: "leads_import" } })).toBe(MAX_IMPORT_ROWS);
    expect(ms).toBeLessThan(60_000);
  }, 120_000);
});

afterEach(() => {
  vi.restoreAllMocks();
});

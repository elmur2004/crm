import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { createLead, getLeadDetail, markReadyToClose } from "./leads";
import { adminWonLeads } from "./won-leads";
import { addWonDocument } from "./won-leads";
import { checkMilestone } from "./milestones";
import { listVaultDocuments, createVaultDocument } from "./vault/documents";
import { createVaultForm, findDuplicateFormUrl } from "./vault/forms";
import { createVaultLink, listVaultLinkCategories, updateVaultLink } from "./vault/links";
import { createVaultTask, listVaultTasks } from "./vault/tasks";
import { createVaultEmployee, listVaultEmployeeCards } from "./vault/employees";
import { vaultOverview } from "./vault/overview";
import { searchVault } from "./vault/search";
import { assertVaultCompany, assertVaultRowVisible, vaultCompaniesOf } from "./vault/tenancy";
import { acctCompaniesOf, assertAcctCompany } from "@/lib/accounting/tenancy";
import { createIncome } from "./accounting";
import { loadBooks } from "@/lib/accounting/books";
import type { Actor } from "./activity";
import type { Role } from "@/lib/pipeline-engine/constants";
import { VAULT_COMPANIES } from "./vault/constants";

/* the whole platform — used only where a case is about something OTHER than
   the wall (seeding a fixture); every assertion about the wall itself passes
   one company's own list. */
const ALL_COMPANIES = VAULT_COMPANIES;

/* ============================================================================
   ADR-074 — "NOTHING INSIDE BSYSTEMS GOES TO MINDOO AND VICE VERSA", against a
   database that holds both.

   The unit tests prove the PREDICATES narrow. This file proves the QUERIES do,
   which is a different claim: a wall that is computed correctly and then not
   passed to the `where` is no wall at all, and that is precisely the shape of
   bug ADR-067 found in `closerWonLeads` (a filter on ownerUserId alone that
   returned the right rows only by luck).

   So every case seeds a TWIN in the other company first, and the assertion that
   matters is always the one about what is ABSENT.
   ========================================================================== */

const actor: Actor = { id: null, label: "Test Admin" };
const BS_ADMIN: Role[] = ["bsystems_admin"];
const MINDOO: Role[] = ["mindoo_staff"];
const bearer = (roles: Role[]) => ({ roles });

let seq = 0;
function lead(brand: "bsystems" | "mindoo", name: string) {
  seq += 1;
  return createLead(brand, { name, number: `010700${String(1000 + seq)}`, type: "cold_call" }, actor);
}

/* a real PDF magic number — the storage layer sniffs content against the
   extension before any of this file's walls run */
function pdfFile() {
  return new File([Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(512, 7)])], "d.pdf", {
    type: "application/pdf",
  });
}

beforeEach(async () => {
  await resetDb();
  seq = 0;
});

describe("the CRM half — a lead belongs to exactly one company", () => {
  it("Mindoo's own reads and writes work end to end", async () => {
    /* the ADR-073 bug, from the service side: the board rendered and every
       action on it was refused. The lead detail and the RTC write are the two
       halves of "can this company actually be used". */
    const l = await lead("mindoo", "Nile Freight");
    const detail = await getLeadDetail("mindoo", l.id);
    expect(detail.lead.name).toBe("Nile Freight");
    const marked = await markReadyToClose("mindoo", l.id, actor);
    expect(marked.readyToClose).toBe(true);
  });

  it("a lead of one company 404s when read under the other", async () => {
    const bs = await lead("bsystems", "Delta Textiles");
    const md = await lead("mindoo", "Delta Foods");
    await expect(getLeadDetail("mindoo", bs.id)).rejects.toThrow();
    await expect(getLeadDetail("bsystems", md.id)).rejects.toThrow();
    /* and the same for the WRITE — a guessed id must not move another
       company's lead */
    await expect(markReadyToClose("mindoo", bs.id, actor)).rejects.toThrow();
  });

  it("Won Leads never mixes the two", async () => {
    const bs = await lead("bsystems", "BS Won");
    const md = await lead("mindoo", "MD Won");
    for (const l of [bs, md]) {
      await db.wonDeal.create({ data: { leadId: l.id, estimatedValue: 100_00 } });
    }
    expect((await adminWonLeads("mindoo")).map((w) => w.lead.name)).toEqual(["MD Won"]);
    expect((await adminWonLeads("bsystems")).map((w) => w.lead.name)).toEqual(["BS Won"]);
  });

  it("a won deal's milestones and documents refuse the other company's id", async () => {
    const md = await lead("mindoo", "MD Deal");
    const deal = await db.wonDeal.create({ data: { leadId: md.id, estimatedValue: 100_00 } });
    const ms = await db.milestone.create({
      data: { wonDealId: deal.id, index: 1, label: "Kickoff", value: 100_00 },
    });
    /* ADR-073's ruling, and ADR-074's extension of it to the documents: an id
       is not proof of ownership once two companies have won deals */
    await expect(checkMilestone(ms.id, "bsystems", actor)).rejects.toThrow();
    await expect(
      addWonDocument(
        deal.id,
        "bsystems",
        "contract",
        new File([Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(512, 7)])], "c.pdf", {
          type: "application/pdf",
        }),
        actor,
      ),
    ).rejects.toThrow();
    /* and its OWN company can, which is what makes the refusal meaningful:
       a wall that refuses everybody is not a wall, it is a broken feature */
    await checkMilestone(ms.id, "mindoo", actor);
    expect((await db.milestone.findUniqueOrThrow({ where: { id: ms.id } })).completed).toBe(true);
  });
});

describe("the accounting module — one screen set, three sets of books", () => {
  it("an account is only ever handed its own companies", () => {
    expect(acctCompaniesOf(bearer(BS_ADMIN))).toEqual(["byteforce", "bsystems"]);
    expect(acctCompaniesOf(bearer(MINDOO))).toEqual(["mindoo"]);
  });

  it("a company on the wire that the account does not hold is refused", () => {
    expect(() => assertAcctCompany(bearer(BS_ADMIN), "mindoo")).toThrow();
    expect(() => assertAcctCompany(bearer(MINDOO), "bsystems")).toThrow();
    /* and its own is accepted */
    expect(assertAcctCompany(bearer(MINDOO), "mindoo")).toBe("mindoo");
  });

  it("the books themselves stay apart", async () => {
    await createIncome(
      { company: "bsystems", month: "2026-09", type: "project", client: "A", serviceLine: "web", amount: 100_00, collected: false, notes: "" } as never,
      actor,
    );
    await createIncome(
      { company: "mindoo", month: "2026-09", type: "project", client: "B", serviceLine: "web", amount: 200_00, collected: false, notes: "" } as never,
      actor,
    );
    const md = await loadBooks("mindoo");
    expect(md.income.map((r) => r.client)).toEqual(["B"]);
    const bs = await loadBooks("bsystems");
    expect(bs.income.map((r) => r.client)).toEqual(["A"]);
  });
});

describe("the data vault — the same registry, partitioned", () => {
  const BS_VISIBLE = vaultCompaniesOf(bearer(BS_ADMIN));
  const MD_VISIBLE = vaultCompaniesOf(bearer(MINDOO));

  /* a real PDF magic number — the storage layer sniffs content against the
     extension, so "x" in a .pdf is refused before any of this file's walls run */
  const pdf = () =>
    new File([Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(512, 7)])], "d.pdf", {
      type: "application/pdf",
    });

  async function seedDocuments() {
    for (const company of ["bsystems", "mindoo"] as const) {
      await createVaultDocument(
        { company, name: `${company} contract`, description: null, type: "contract" },
        pdf(),
        actor,
      );
    }
  }

  it("a list returns only the reader's companies", async () => {
    await seedDocuments();
    const mine = await listVaultDocuments({ archived: false }, MD_VISIBLE);
    expect(mine.map((d) => d.company)).toEqual(["mindoo"]);
    const theirs = await listVaultDocuments({ archived: false }, BS_VISIBLE);
    expect(theirs.map((d) => d.company)).toEqual(["bsystems"]);
  });

  it("a ?company= filter naming somebody else's company is IGNORED, not obeyed", async () => {
    await seedDocuments();
    const rows = await listVaultDocuments({ archived: false, company: "bsystems" }, MD_VISIBLE);
    expect(rows.map((d) => d.company)).toEqual(["mindoo"]);
  });

  it("an untagged row belongs to the original pair and never to Mindoo", async () => {
    const employee = await createVaultEmployee({ name: "Untagged", title: null, company: null }, actor);
    await createVaultTask(
      { employeeId: employee.id, company: null, name: "Shared chore", description: null, deadline: "2026-12-01", priority: "normal" } as never,
      ALL_COMPANIES,
      actor,
    );
    await createVaultTask(
      { employeeId: employee.id, company: "mindoo", name: "Mindoo chore", description: null, deadline: "2026-12-01", priority: "normal" } as never,
      ALL_COMPANIES,
      actor,
    );
    const mine = await listVaultTasks({ archived: false }, MD_VISIBLE);
    expect(mine.map((t) => t.name)).toEqual(["Mindoo chore"]);
    const theirs = await listVaultTasks({ archived: false }, BS_VISIBLE);
    expect(theirs.map((t) => t.name)).toEqual(["Shared chore"]);
    /* the employee card the same way */
    expect((await listVaultEmployeeCards(MD_VISIBLE)).map((c) => c.name)).toEqual([]);
    expect((await listVaultEmployeeCards(BS_VISIBLE)).map((c) => c.name)).toEqual(["Untagged"]);
  });

  it("the landing COUNTS are scoped — a count is a disclosure too", async () => {
    await seedDocuments();
    expect((await vaultOverview(MD_VISIBLE)).documents).toBe(1);
    expect((await vaultOverview(BS_VISIBLE)).documents).toBe(1);
  });

  it("search never surfaces another company's record", async () => {
    await seedDocuments();
    const hits = await searchVault("contract", MD_VISIBLE);
    expect(hits.groups.documents.map((h) => h.title)).toEqual(["mindoo contract"]);
  });

  it("a record's own id is not a key to it", async () => {
    await seedDocuments();
    const theirs = await db.vaultDocument.findFirstOrThrow({ where: { company: "bsystems" } });
    await expect(
      assertVaultRowVisible(bearer(MINDOO), "document", theirs.id),
    ).rejects.toThrow();
    /* and its owner still gets through */
    await expect(
      assertVaultRowVisible(bearer(BS_ADMIN), "document", theirs.id),
    ).resolves.toBeUndefined();
  });

  it("Mindoo cannot create an UNTAGGED row it would then be unable to see", () => {
    expect(() => assertVaultCompany(bearer(MINDOO), null)).toThrow();
    /* the original pair still can — null has always meant "not tagged" there */
    expect(assertVaultCompany(bearer(BS_ADMIN), null)).toBeNull();
  });
});

describe("the holes an adversarial review found, each closed and each pinned", () => {
  /* Every case below is a defect that SHIPPED in this change and was caught by
     reading the source rather than by the suite. They are gathered here on
     purpose: the list is the honest record of what a tenancy wall gets wrong
     when it is built entity by entity, and the shape repeats — a list is
     scoped, and the COUNT beside it is not; a row is scoped, and the FILE
     behind it is not; a read is scoped, and the WRITE that follows it is not. */

  const BS_VISIBLE = vaultCompaniesOf(bearer(BS_ADMIN));
  const MD_VISIBLE = vaultCompaniesOf(bearer(MINDOO));

  it("the landing's RECENT ACTIVITY feed is scoped — a log line is a sentence, not a count", async () => {
    await createVaultDocument(
      { company: "bsystems", name: "Q4 Contract", description: null, type: "contract" },
      pdfFile(),
      actor,
    );
    /* the feed carries the entity id; ActivityLog has no company column and
       cannot have one, so the wall is by RESOLVED ID (see vaultOverview) */
    const theirs = await vaultOverview(BS_VISIBLE);
    expect(theirs.activity.length).toBeGreaterThan(0);
    const mine = await vaultOverview(MD_VISIBLE);
    expect(mine.activity).toEqual([]);
  });

  it("the link CATEGORY list is one company's own vocabulary", async () => {
    await createVaultLink(
      { company: "bsystems", name: "BS deck", url: "https://a.example/1", category: "Investor Deck Q4", type: "document", notes: null } as never,
      BS_VISIBLE,
      actor,
    );
    expect(await listVaultLinkCategories(BS_VISIBLE)).toContain("Investor Deck Q4");
    expect(await listVaultLinkCategories(MD_VISIBLE)).toEqual([]);
  });

  it("re-spelling a category never rewrites ANOTHER company's rows", async () => {
    /* HIS OWN word, not one of our eight suggestions: the suggestion pairs go
       down `canonicalise` instead, and it is the re-spelling path — the one
       with the `updateMany` behind it — that this case is about. */
    const theirs = await createVaultLink(
      { company: "bsystems", name: "BS deck", url: "https://a.example/2", category: "investor deck q4", type: "document", notes: null } as never,
      BS_VISIBLE,
      actor,
    );
    const mine = await createVaultLink(
      { company: "mindoo", name: "MD deck", url: "https://a.example/3", category: "investor deck q4", type: "document", notes: null } as never,
      MD_VISIBLE,
      actor,
    );
    /* Mindoo re-spells ITS OWN category. Unscoped, the `updateMany` behind this
       renamed every row that folds to the same key — including B-Systems'. */
    await updateVaultLink(
      mine.id,
      { company: "mindoo", name: "MD deck", url: "https://a.example/3", category: "Investor Deck Q4", type: "document", notes: null } as never,
      MD_VISIBLE,
      actor,
    );
    expect((await db.vaultLink.findUniqueOrThrow({ where: { id: mine.id } })).category).toBe(
      "Investor Deck Q4",
    );
    expect((await db.vaultLink.findUniqueOrThrow({ where: { id: theirs.id } })).category).toBe(
      "investor deck q4",
    );
  });

  it("the duplicate-URL handshake never names another company's record", async () => {
    await createVaultForm(
      { company: "bsystems", name: "Secret Intake Form", url: "https://f.example/1", notes: null } as never,
      BS_VISIBLE,
      actor,
    );
    /* the 409 body carries the clashing form's NAME, so an unscoped check was
       an existence oracle with a label on it */
    expect(await findDuplicateFormUrl("https://f.example/1", MD_VISIBLE)).toBeNull();
    expect(await findDuplicateFormUrl("https://f.example/1", BS_VISIBLE)).not.toBeNull();
  });

  it("an employee card's COUNTS only count work the reader may see", async () => {
    const shared = await createVaultEmployee({ name: "Shared", title: null, company: null }, actor);
    await createVaultTask(
      { employeeId: shared.id, company: "bsystems", name: "Their chore", description: null, deadline: "2026-12-01", priority: "normal" } as never,
      BS_VISIBLE,
      actor,
    );
    const cards = await listVaultEmployeeCards(BS_VISIBLE);
    expect(cards.find((c) => c.name === "Shared")?.openCount).toBe(1);
    /* Mindoo cannot see the card at all, so it certainly cannot see its number */
    expect((await listVaultEmployeeCards(MD_VISIBLE)).find((c) => c.name === "Shared")).toBeUndefined();
  });

  it("a task cannot be assigned to a person the assigner cannot see", async () => {
    const theirs = await createVaultEmployee(
      { name: "B-Systems only", title: null, company: "bsystems" },
      actor,
    );
    await expect(
      createVaultTask(
        { employeeId: theirs.id, company: "mindoo", name: "Sneaky", description: null, deadline: "2026-12-01", priority: "normal" } as never,
        MD_VISIBLE,
        actor,
      ),
    ).rejects.toThrow();
  });
});

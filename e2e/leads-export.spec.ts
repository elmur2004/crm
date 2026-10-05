import { expect, test, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

/* ============================================================================
   ADR-083 — the two export buttons, in a browser.

   Founder: "add a button to export all leads in an excel sheet / a button for
   bsystems and a button for byteforce", on the Leads page, and the file is
   "every lead, ever — live pipeline, won, lost AND archived".

   What this file is for, beyond the unit and integration suites: that the
   BUTTONS are on the right screen for the right account, that pressing one
   really downloads a real spreadsheet (not just that a handler returns bytes),
   and that the two accounts who must not have a company-wide list cannot get
   one by typing the URL. The seeded database has both companies' leads, won and
   lost ones among them, so a leak across companies would show up here as a name
   in the wrong file.
   ========================================================================== */

const BF = "?company=byteforce";
const BS = "?company=bsystems";

async function login(page: Page, id: string, landing: RegExp, password = "password123") {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(id);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

const btn = (page: Page, company: "ByteForce" | "B-Systems") =>
  page.getByRole("link", { name: `Export leads — ${company}` });

/** The generated workbook's shared strings — every text cell in the file. */
function sharedStrings(bytes: Buffer): string {
  const zip = unzipSync(new Uint8Array(bytes));
  expect(Object.keys(zip)).toContain("xl/worksheets/sheet1.xml");
  return strFromU8(zip["xl/sharedStrings.xml"]!);
}

function sheetXml(bytes: Buffer): string {
  return strFromU8(unzipSync(new Uint8Array(bytes))["xl/worksheets/sheet1.xml"]!);
}

/* -------------------------------------------------------------------------- */

test("the founder sees BOTH buttons on the Leads page — on either company's screen", async ({
  page,
}) => {
  /* admin@byteforce.com holds bsystems_admin AND byteforce_staff */
  await login(page, "admin@byteforce.com", /\/b-systems$/);

  /* B-Systems' Leads is a filterable table… */
  await page.goto(`/b-systems/leads${BS}`);
  await expect(btn(page, "B-Systems")).toBeVisible();
  await expect(btn(page, "ByteForce")).toBeVisible();
  await expect(page.getByText("Every lead, ever — live, won, lost and archived.")).toBeVisible();

  /* …and ByteForce's is the rep directory. Two different screens, one address,
     and the pair of buttons belongs on both. */
  await page.goto(`/b-systems/leads${BF}`);
  await expect(page.getByRole("link", { name: /Laila Mostafa/ })).toBeVisible();
  await expect(btn(page, "B-Systems")).toBeVisible();
  await expect(btn(page, "ByteForce")).toBeVisible();

  /* the buttons are NOT on the CRM board — he asked for the Leads page */
  await page.goto(`/b-systems/crm${BS}`);
  await expect(btn(page, "B-Systems")).toHaveCount(0);
  await expect(btn(page, "ByteForce")).toHaveCount(0);
});

test("pressing a button downloads a real .xlsx named for the company and the day", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", /\/b-systems$/);
  await page.goto(`/b-systems/leads${BS}`);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    btn(page, "B-Systems").click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^b-systems-leads-\d{4}-\d{2}-\d{2}\.xlsx$/);

  /* and the other button is a DIFFERENT file, so the two cannot collide */
  const [second] = await Promise.all([
    page.waitForEvent("download"),
    btn(page, "ByteForce").click(),
  ]);
  expect(second.suggestedFilename()).toMatch(/^byteforce-leads-\d{4}-\d{2}-\d{2}\.xlsx$/);
  expect(second.suggestedFilename()).not.toBe(download.suggestedFilename());
});

test("the file holds every lead of ITS company — won, lost and archived — and none of the other's", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", /\/b-systems$/);

  /* archive one lead through the product, so the file is proven to include a
     lead that is on NO screen any more */
  const made = await page.request.post("/api/b-systems/leads", {
    data: {
      name: "Archived On Purpose",
      number: "0107779001",
      type: "cold_call",
      companyName: "Filed Away Ltd",
    },
  });
  expect(made.status()).toBe(201);
  const { id } = (await made.json()) as { id: string };
  expect(
    (await page.request.post(`/api/b-systems/leads/${id}/archive`, { data: { value: true } })).ok(),
  ).toBe(true);

  const res = await page.request.get("/api/b-systems/leads/export");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("spreadsheetml.sheet");
  const bytes = Buffer.from(await res.body());
  expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK");

  const strings = sharedStrings(bytes);
  /* the archived one */
  expect(strings).toContain("<t>Archived On Purpose</t>");
  expect(strings).toContain("<t>Archived</t>");
  /* the seed's won and lost B-Systems leads */
  expect(strings).toContain("<t>Delta Medical Group</t>");
  expect(strings).toContain("<t>Delta Motors</t>");
  /* and NOT ByteForce's, whose leads share the same stages and reps */
  expect(strings).not.toContain("<t>Cairo Medical Group</t>");
  expect(strings).not.toContain("<t>Cairo Textiles</t>");

  /* the row count the server reports matches the rows it wrote */
  const rows = Number(res.headers()["x-lead-rows"]);
  expect(rows).toBeGreaterThan(5);
  const dataRows = (sheetXml(bytes).match(/<row r="/g) ?? []).length - 1;
  expect(dataRows).toBe(rows);
});

test("a seeded phone keeps its leading zero as TEXT in the real file", async ({ page }) => {
  await login(page, "admin@byteforce.com", /\/b-systems$/);
  const res = await page.request.get("/api/b-systems/leads/export");
  const bytes = Buffer.from(await res.body());
  const strings = sharedStrings(bytes);

  /* "0221000001" is a seeded number. In a CSV Excel would open it as
     221000001 — which is the entire reason this is a spreadsheet. */
  expect(strings).toContain("<t>0221000001</t>");
  expect(sheetXml(bytes)).not.toContain("<v>221000001</v>");
});

test("an Arabic viewer gets Arabic headers and a right-to-left sheet", async ({ page }) => {
  await login(page, "admin@byteforce.com", /\/b-systems$/);
  await page.goto(`/b-systems/leads${BS}`);
  await page.getByRole("button", { name: "عربي" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  /* the button itself is Arabic, and still names its company */
  await expect(page.getByRole("link", { name: "تصدير العملاء المحتملين — B-Systems" })).toBeVisible();

  const res = await page.request.get("/api/b-systems/leads/export");
  expect(res.status()).toBe(200);
  const bytes = Buffer.from(await res.body());
  expect(sharedStrings(bytes)).toContain("<t>الاسم</t>"); // "Name"
  expect(sharedStrings(bytes)).not.toContain("<t>Name</t>");
  expect(sheetXml(bytes)).toContain('rightToLeft="1"');
});

/* -------------------------------------------------------------------------- */

test("internal sales cannot reach the Leads page, and cannot pull the list by URL", async ({
  page,
}) => {
  await login(page, "omar@b-systems.example", /\/b-systems\/crm/, "bsystems123");

  /* the page itself bounces him — the wall the export copies */
  await page.goto(`/b-systems/leads${BS}`);
  await expect(page).not.toHaveURL(/\/b-systems\/leads/);
  await expect(btn(page, "B-Systems")).toHaveCount(0);

  /* and the endpoint refuses him even with a valid session */
  const refused = await page.request.get("/api/b-systems/leads/export");
  expect(refused.status()).toBe(403);
  expect(await refused.text()).not.toContain("Delta Medical Group");

  const other = await page.request.get("/api/byteforce/leads/export");
  expect(other.status()).toBe(403);
});

test("an agent cannot pull a company-wide list", async ({ page }) => {
  /* an agent sees only its OWN leads everywhere in this product; one file
     would undo that in a single click */
  await login(page, "nourhan.agent@b-systems.example", /\/b-systems\/crm$/, "agent123");
  await page.goto(`/b-systems/leads${BS}`);
  await expect(btn(page, "B-Systems")).toHaveCount(0);
  expect((await page.request.get("/api/b-systems/leads/export")).status()).toBe(403);
  expect((await page.request.get("/api/byteforce/leads/export")).status()).toBe(403);
});

test("a ByteForce-only teammate gets ONE button, and the B-Systems URL refuses him", async ({
  page,
}) => {
  await login(page, "sara@byteforce.example", /\/b-systems\?company=byteforce$/, "byteforce123");
  await page.goto(`/b-systems/leads${BF}`);

  await expect(btn(page, "ByteForce")).toBeVisible();
  await expect(btn(page, "B-Systems")).toHaveCount(0);

  /* his own company's file works */
  const mine = await page.request.get("/api/byteforce/leads/export");
  expect(mine.status()).toBe(200);
  expect(sharedStrings(Buffer.from(await mine.body()))).toContain("<t>Cairo Textiles</t>");

  /* the other company's, typed by hand, does not — and leaks nothing */
  const theirs = await page.request.get("/api/b-systems/leads/export");
  expect(theirs.status()).toBe(403);
  expect(await theirs.text()).not.toContain("Delta Medical Group");
});

test("a signed-out request gets nothing at either address", async ({ page }) => {
  for (const url of ["/api/b-systems/leads/export", "/api/byteforce/leads/export"]) {
    const res = await page.request.get(url);
    expect(res.status()).toBe(401);
  }
});

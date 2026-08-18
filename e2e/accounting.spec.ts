import { expect, test, type Page } from "@playwright/test";

/* ADR-052 Phase 2 — the accounting module end-to-end:
   (1) admin books a month: income + expense, approves it, watches the
       dashboard numbers move (cash basis + the approval gate, in the UI);
   (2) founder decision 5: the Media Buying tab does not exist under the
       B-Systems company filter, and its URL bounces to the dashboard;
   (3) the one-time import: upload a tiny fixture export, read back the
       derived reconciliation totals, see them on the dashboard;
   (4) the 403 matrix: every accounting route refuses sales, agent and
       data-entry sessions (partner accounts are provisioned mid-flow, not
       seeded — the identical requireBsAdmin wall refuses them by the same
       role list, proven here through three live non-admin roles). */

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

const cairoMonth = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date()); // "YYYY-MM"

test("admin books income + expense, approves it, and the dashboard moves", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);

  /* the nav item exists and lands on the dashboard */
  await page.goto("/accounting");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  /* ---- income: 4,321 EGP collected today (cash basis: lands this month) */
  await page.goto("/accounting/income");
  await page.getByRole("button", { name: "+ Add income" }).click();
  const modal = page.locator(".modal");
  await modal.getByLabel("Client name").fill("E2E Client");
  await modal.getByLabel("Amount (EGP)").fill("4321");
  await modal.getByLabel("Status").selectOption("true"); // Collected
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal).toBeHidden();
  await expect(page.locator("tr", { hasText: "E2E Client" }).getByText("Collected", { exact: true })).toBeVisible();

  /* ---- expense: 1,111 EGP, stays ON HOLD — must not touch cash yet */
  await page.goto("/accounting/expenses");
  await page.getByRole("button", { name: "+ Add expense" }).click();
  await modal.getByLabel("Name / payee").fill("E2E Hosting");
  await modal.getByLabel("Amount (EGP)").fill("1111");
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal).toBeHidden();
  const row = page.locator("tr", { hasText: "E2E Hosting" });
  await expect(row.getByText("On hold", { exact: true })).toBeVisible();

  /* ---- dashboard: income counted, expense only in "to be paid", net = income */
  await page.goto("/accounting");
  await expect(page.getByText("EGP 4,321").first()).toBeVisible(); // collected + net
  await expect(page.getByText("EGP 1,111").first()).toBeVisible(); // on hold tile

  /* ---- approve the expense — NOW it hits cash */
  await page.goto("/accounting/expenses");
  await row.locator("button").first().click(); // the ✓ approve toggle
  await expect(row.getByText("Paid", { exact: true })).toBeVisible();

  await page.goto("/accounting");
  await expect(page.getByText("EGP 3,210").first()).toBeVisible(); // 4,321 − 1,111
});

test("B-Systems company filter hides Media Buying entirely", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);

  /* under ByteForce the tab exists — and the module WEARS the ByteForce brand
     (directive D: the shell re-stamps [data-brand] with the company) */
  await page.goto("/accounting?company=byteforce");
  await expect(page.getByRole("link", { name: "Media Buying" })).toBeVisible();
  await expect(page.locator('div[data-brand="byteforce"]')).toBeVisible();
  await expect(page.locator('div[data-brand="bsystems"]')).toHaveCount(0);

  /* under B-Systems it is gone from the strip — and the brand swaps whole */
  await page.goto("/accounting?company=bsystems");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Media Buying" })).toHaveCount(0);
  await expect(page.locator('div[data-brand="bsystems"]')).toBeVisible();

  /* …and the URL itself bounces back to the dashboard */
  await page.goto("/accounting/media?company=bsystems");
  await page.waitForURL(/\/accounting\?company=bsystems/);
});

test("the import screen ingests the old app's export and reports the derived totals", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  const M0 = cairoMonth();
  /* a minimal single-company export in the SPA's own shape (EGP integers) */
  const fixture = {
    openingBalance: 100,
    income: [
      {
        id: "a1",
        month: M0,
        type: "invoice",
        client: "Imported Co",
        serviceLine: "web",
        amount: 500,
        note: "",
        collected: true,
        collectedDate: `${M0}-05`,
        paidMonth: M0,
      },
    ],
    expenses: [],
    roster: [],
    treasury: [],
    loans: [],
    mediaLedger: [],
    targets: [],
    payrollPaid: {},
  };

  await page.goto("/accounting/import?company=bsystems");
  await page.locator('input[name="file"]').setInputFiles({
    name: "bsystems-accounting-export.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.getByRole("button", { name: "Import books" }).click();

  await expect(page.getByText("Imported. Reconcile these totals against the old app:")).toBeVisible();
  await expect(page.getByText("EGP 600").first()).toBeVisible(); // 100 opening + 500 collected

  /* the dashboard under the B-Systems filter shows the imported treasury */
  await page.goto("/accounting?company=bsystems");
  await expect(page.getByText("EGP 600").first()).toBeVisible();
  await expect(page.getByText("Imported Co")).toHaveCount(0); // client names live on their own tab

  /* ---- ADR-054 directive C: the EXPORT beside Import emits the ORIGINAL
     SPA's file — same shape, same money-in-EGP, the SPA's own filename */
  const exported = await page.request.get("/api/accounting/export?company=bsystems");
  expect(exported.ok()).toBeTruthy();
  expect(exported.headers()["content-disposition"]).toMatch(
    /bsystems-accounting-\d{4}-\d{2}-\d{2}\.json/,
  );
  const doc = (await exported.json()) as {
    openingBalance: number;
    income: Array<{ client: string; amount: number }>;
    payrollPaid: Record<string, string>;
  };
  expect(doc.openingBalance).toBe(100);
  expect(doc.income[0]!.client).toBe("Imported Co");
  expect(doc.income[0]!.amount).toBe(500);

  /* the "Export ALL companies" wrapper names both tenants like the SPA's */
  const all = await page.request.get("/api/accounting/export?all=1");
  expect(all.headers()["content-disposition"]).toMatch(/all-companies-\d{4}-\d{2}-\d{2}\.json/);
  const wrapper = (await all.json()) as Record<string, { openingBalance: number }>;
  expect(wrapper["bsystems"]!.openingBalance).toBe(100);
  expect(wrapper["byteforce"]).toBeDefined();

  /* and both Export controls sit beside Import on the screen itself */
  await page.goto("/accounting/import?company=bsystems");
  await expect(page.getByRole("link", { name: "Export ALL companies (JSON)" })).toBeVisible();
});

test("every accounting route refuses non-admin roles (server-side 403 matrix)", async ({
  browser,
}) => {
  const routes: Array<[string, string]> = [
    ["POST", "/api/accounting/income"],
    ["PATCH", "/api/accounting/income/x"],
    ["DELETE", "/api/accounting/income/x?company=byteforce"],
    ["POST", "/api/accounting/expenses"],
    ["PATCH", "/api/accounting/expenses/x"],
    ["DELETE", "/api/accounting/expenses/x?company=byteforce"],
    ["POST", "/api/accounting/payroll-paid"],
    ["POST", "/api/accounting/roster"],
    ["PATCH", "/api/accounting/roster/x"],
    ["DELETE", "/api/accounting/roster/x?company=byteforce"],
    ["POST", "/api/accounting/media"],
    ["POST", "/api/accounting/loans"],
    ["DELETE", "/api/accounting/loans/x?company=byteforce"],
    ["POST", "/api/accounting/loans/x/payments"],
    ["POST", "/api/accounting/treasury"],
    ["PATCH", "/api/accounting/treasury/x"],
    ["DELETE", "/api/accounting/treasury/x?company=byteforce"],
    ["PUT", "/api/accounting/settings"],
    ["POST", "/api/accounting/targets"],
    ["DELETE", "/api/accounting/targets/x?company=byteforce"],
    ["POST", "/api/accounting/import"],
    ["GET", "/api/accounting/export?company=byteforce"], // ADR-054
    ["GET", "/api/accounting/export?all=1"],
  ];

  const sessions: Array<[string, string, RegExp]> = [
    ["omar@b-systems.example", "bsystems123", /\/b-systems\/crm$/], // internal sales
    ["01001234567", "partner123", /\/b-systems\/crm$/], // agent
    ["entry@b-systems.example", "entry123", /\/b-systems\/entry$/], // data entry
  ];

  for (const [identifier, password, landing] of sessions) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, identifier, password, landing);

    for (const [method, url] of routes) {
      const res = await page.request.fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        data: method === "GET" ? undefined : "{}",
      });
      expect(res.status(), `${identifier} ${method} ${url}`).toBe(403);
    }

    /* the PAGES bounce a signed-in non-admin to their own landing, never 500 */
    await page.goto("/accounting");
    await expect(page).not.toHaveURL(/\/accounting/);

    await context.close();
  }
});

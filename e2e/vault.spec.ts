import { expect, test, type Page } from "@playwright/test";

/* ADR-053 Phase 5 — the Data Vault end-to-end:
   (1) admin creates an employee CARD, assigns them a task, tries to complete
       it WITHOUT a result — the panel refuses (and the API answers 422 with
       the task still open) — then records a result, completes, and the frozen
       "On time" verdict shows;
   (2) a sheet is created from an uploaded CSV and its record count is read
       from the file itself;
   (3) a document is created (PDF), archived (leaves the list), restored from
       the Archive tab (returns);
   (4) the 403 matrix: every vault route refuses internal sales, agent and
       data-entry sessions (partners are provisioned mid-flow, not seeded —
       the identical requireBsAdmin wall refuses them by the same role list). */

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

const cairoToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // "YYYY-MM-DD"

test("employee card → task → gate refuses → result completes → On time", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);

  /* the nav item exists and lands on the overview */
  await page.goto("/b-systems/vault");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  /* ---- the employee CARD (a card, not an account) */
  await page.goto("/b-systems/vault/employees");
  await page.getByRole("button", { name: "+ Add employee" }).click();
  const modal = page.locator(".modal");
  await modal.getByLabel("Name").fill("Vault E2E Employee");
  await modal.getByLabel("Job title").fill("QA Runner");
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByText("Vault E2E Employee").first()).toBeVisible();

  /* ---- the task, due today */
  await page.goto("/b-systems/vault/tasks");
  await page.getByRole("button", { name: "+ Add task" }).click();
  await modal.getByLabel("Name").fill("Vault E2E gated task");
  await modal.getByLabel("Assignee").selectOption({ label: "Vault E2E Employee" });
  await modal.getByLabel("Deadline").fill(cairoToday());
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal).toBeHidden();
  const row = page.locator("tr", { hasText: "Vault E2E gated task" });
  await expect(row.getByText("Open", { exact: true })).toBeVisible();

  /* ---- completing WITHOUT a result: the panel refuses (the server's 422),
     the modal stays up with the gate's message, and the task stays open */
  await row.getByRole("button", { name: "Complete task" }).click();
  await expect(page.getByText("Record the result")).toBeVisible();
  await page.getByRole("button", { name: "Save & complete" }).click();
  await expect(
    page.getByText("Add a result before completing this task — a note, a file, or a link."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(row.getByText("Open", { exact: true })).toBeVisible(); // nothing committed

  /* ---- record a result and complete in the same step (one action, not two) */
  await row.getByRole("button", { name: "Complete task" }).click();
  await page.getByLabel("Result note").fill("Done — verified by the e2e run.");
  await page.getByRole("button", { name: "Save & complete" }).click();
  await expect(page.getByText("Record the result")).toBeHidden();
  await expect(row.getByText("Completed", { exact: true })).toBeVisible();
  await expect(row.getByText("On time", { exact: true })).toBeVisible(); // frozen at completion
});

test("a CSV sheet upload is counted from the file itself", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  await page.goto("/b-systems/vault/sheets");
  await page.getByRole("button", { name: "+ Add sheet" }).click();
  const modal = page.locator(".modal");
  await modal.getByLabel("Name").fill("Vault E2E csv sheet");
  await modal.getByLabel("Date created").fill(cairoToday());
  await modal.getByLabel("Stored as").selectOption("file");
  await modal.locator('input[name="file"]').setInputFiles({
    name: "leads.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Name,Phone\nSalma,0100111\nOmar,0122333\nNour,0111222\n"),
  });
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal).toBeHidden();
  const row = page.locator("tr", { hasText: "Vault E2E csv sheet" });
  await expect(row.locator("td").nth(4)).toContainText("3"); // 3 data rows, header detected
  await expect(row.getByText("leads.csv")).toBeVisible();
});

test("a document archives (leaves the list) and restores from the Archive tab", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  await page.goto("/b-systems/vault/documents");
  await page.getByRole("button", { name: "+ Add document" }).click();
  const modal = page.locator(".modal");
  await modal.getByLabel("Name").fill("Vault E2E contract");
  await modal.locator('input[name="file"]').setInputFiles({
    name: "contract.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(2048, 7)]),
  });
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal).toBeHidden();
  const row = page.locator("tr", { hasText: "Vault E2E contract" });
  await expect(row.getByText("contract.pdf")).toBeVisible();

  /* archive = confirm, then the row leaves the default list */
  await row.getByRole("button", { name: "Archive" }).first().click();
  await row.getByRole("button", { name: "Archive" }).last().click();
  await expect(page.locator("tr", { hasText: "Vault E2E contract" })).toHaveCount(0);

  /* the Archive tab holds it, restorable in one click */
  await page.goto("/b-systems/vault/archive");
  const archivedRow = page.locator("tr", { hasText: "Vault E2E contract" });
  await expect(archivedRow.getByText("Archived", { exact: true })).toBeVisible();
  await archivedRow.getByRole("button", { name: "Unarchive" }).click();
  await expect(page.locator("tr", { hasText: "Vault E2E contract" })).toHaveCount(0);

  await page.goto("/b-systems/vault/documents");
  await expect(page.locator("tr", { hasText: "Vault E2E contract" })).toHaveCount(1);
});

test("every vault route refuses non-admin roles (server-side 403 matrix)", async ({
  browser,
}) => {
  const routes: Array<[string, string]> = [
    ["POST", "/api/b-systems/vault/employees"],
    ["PATCH", "/api/b-systems/vault/employees/x"],
    ["POST", "/api/b-systems/vault/forms"],
    ["PATCH", "/api/b-systems/vault/forms/x"],
    ["POST", "/api/b-systems/vault/forms/x/archive"],
    ["POST", "/api/b-systems/vault/sheets"],
    ["PATCH", "/api/b-systems/vault/sheets/x"],
    ["POST", "/api/b-systems/vault/sheets/x/file"],
    ["POST", "/api/b-systems/vault/sheets/x/archive"],
    ["POST", "/api/b-systems/vault/documents"],
    ["PATCH", "/api/b-systems/vault/documents/x"],
    ["POST", "/api/b-systems/vault/documents/x/file"],
    ["POST", "/api/b-systems/vault/documents/x/archive"],
    ["POST", "/api/b-systems/vault/tasks"],
    ["PATCH", "/api/b-systems/vault/tasks/x"],
    ["POST", "/api/b-systems/vault/tasks/x/result"],
    ["POST", "/api/b-systems/vault/tasks/x/complete"],
    ["POST", "/api/b-systems/vault/tasks/x/reopen"],
    ["POST", "/api/b-systems/vault/tasks/x/archive"],
    ["GET", "/api/b-systems/vault/search?q=x"],
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
    await page.goto("/b-systems/vault");
    await expect(page).not.toHaveURL(/\/vault/);

    await context.close();
  }
});

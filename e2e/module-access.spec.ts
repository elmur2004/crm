import { expect, test, type Page } from "@playwright/test";

/* ============================================================================
   ADR-066 — PER-ADMIN module access, end to end.

   Founder: "I want to have the ability to block some admins from acsessing
   accounting or data vault."

   The whole loop, through the real UI: the founder makes a second admin with
   the Data Vault withheld; that admin does not see the segment in EITHER
   switcher shape (the desktop header pill AND the phone module bar); typing the
   URL gets an honest refusal, not a crash, a loop, or a blank page; the API
   refuses him too; and everything else he owns still works. The founder's own
   account is untouched throughout.
   ========================================================================== */

const BLOCKED_EMAIL = "novault@b-systems.example";
const ALLOWED_EMAIL = "bothmodules@b-systems.example";
const PASSWORD = "modules123";

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

async function loginAsFounder(page: Page) {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
}

/** Make an admin through the real Add-user form, ticking/unticking modules. */
async function createAdmin(
  page: Page,
  opts: { name: string; email: string; vault: boolean; accounting: boolean },
) {
  await page.goto("/b-systems/users");
  await page.getByRole("button", { name: "Add user" }).click();
  await page.getByLabel("Name").fill(opts.name);
  await page.getByLabel("Email").fill(opts.email);
  await page.getByLabel("Password (min 8)").fill(PASSWORD);

  /* the module boxes appear only once B-Systems admin is ticked — they narrow
     that role and mean nothing without it */
  await expect(page.getByRole("group", { name: "Modules" })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "B-Systems admin" }).check();
  const modules = page.getByRole("group", { name: "Modules" });
  await expect(modules).toBeVisible();
  /* both start ticked: a new admin is born with everything, like every account
     that already exists */
  await expect(modules.getByRole("checkbox", { name: "Accounting" })).toBeChecked();
  await expect(modules.getByRole("checkbox", { name: "Data Vault" })).toBeChecked();

  if (!opts.accounting) await modules.getByRole("checkbox", { name: "Accounting" }).uncheck();
  if (!opts.vault) await modules.getByRole("checkbox", { name: "Data Vault" }).uncheck();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("row", { name: new RegExp(opts.name) })).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test("the founder withholds the Data Vault from a new admin, and the row says so", async ({
  page,
}) => {
  await loginAsFounder(page);
  await createAdmin(page, {
    name: "Nour NoVault",
    email: BLOCKED_EMAIL,
    accounting: true,
    vault: false,
  });

  const row = page.getByRole("row", { name: /Nour NoVault/ });
  await expect(row.getByText("No Data Vault")).toBeVisible();
  await expect(row.getByText("No Accounting")).toHaveCount(0);

  /* a second admin with BOTH, so the "an allowed admin is unaffected" half of
     this feature is proved against a fresh account too */
  await createAdmin(page, {
    name: "Rana Both",
    email: ALLOWED_EMAIL,
    accounting: true,
    vault: true,
  });
  const other = page.getByRole("row", { name: /Rana Both/ });
  await expect(other.getByText("No Data Vault")).toHaveCount(0);
  await expect(other.getByText("No Accounting")).toHaveCount(0);
});

test("the blocked admin never sees VAULT in the header pill, and the URL refuses him", async ({
  page,
}) => {
  await login(page, BLOCKED_EMAIL, PASSWORD, /\/b-systems$/);

  /* desktop header pill: ACCOUNTING is there, VAULT is gone */
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/b-systems");
  const pill = page.locator(".app-header .user .switcher-entity");
  await expect(pill).toBeVisible();
  await expect(pill.getByRole("link", { name: "ACCOUNTING" })).toBeVisible();
  await expect(pill.getByRole("link", { name: "VAULT" })).toHaveCount(0);
  await expect(pill.getByRole("link", { name: "B-SYSTEMS" })).toBeVisible();

  /* typing the URL: an honest refusal that NAMES the module, and a way back */
  await page.goto("/vault");
  await page.waitForURL(/\/no-access\?module=vault/);
  await expect(
    page.getByRole("heading", { name: "The Data Vault is not open to your account" }),
  ).toBeVisible();
  await expect(page.getByText("Nothing else changed", { exact: false })).toBeVisible();
  /* a real page, not a blank one, and not a loop */
  await expect(page.getByRole("link", { name: "Back to your dashboard" })).toBeVisible();
  await page.getByRole("link", { name: "Back to your dashboard" }).click();
  await page.waitForURL(/\/b-systems$/);

  /* a deep URL inside the module is refused just the same */
  await page.goto("/vault/tasks");
  await page.waitForURL(/\/no-access\?module=vault/);

  /* the API is the real wall, and it says which module it refused */
  const api = await page.request.get("/api/vault/search?q=x");
  expect(api.status()).toBe(403);
  expect(JSON.stringify(await api.json())).toContain("Data Vault");
});

test("the blocked admin still has ACCOUNTING and everything else", async ({ page }) => {
  await login(page, BLOCKED_EMAIL, PASSWORD, /\/b-systems$/);

  await page.goto("/accounting");
  await expect(page).toHaveURL(/\/accounting$/);
  expect((await page.request.get("/api/accounting/export?company=bsystems")).status()).toBe(200);

  /* the rest of the CRM is untouched — this is a module switch, not a demotion */
  await page.goto("/b-systems/users");
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  await page.goto("/b-systems/crm");
  await expect(page).toHaveURL(/\/b-systems\/crm$/);
});

test("the phone MODULE BAR drops the segment too, and never overflows", async ({ page }) => {
  await login(page, BLOCKED_EMAIL, PASSWORD, /\/b-systems$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/b-systems");

  const bar = page.locator(".switcher--bar");
  await expect(bar).toBeVisible();
  await expect(bar.getByRole("link", { name: "ACCOUNTING" })).toBeVisible();
  await expect(bar.getByRole("link", { name: "VAULT" })).toHaveCount(0);
  /* ADR-060's contract still holds on the shortened bar */
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("an allowed admin is completely unaffected — both segments, both modules", async ({
  page,
}) => {
  await login(page, ALLOWED_EMAIL, PASSWORD, /\/b-systems$/);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/b-systems");
  const pill = page.locator(".app-header .user .switcher-entity");
  await expect(pill.getByRole("link", { name: "ACCOUNTING" })).toBeVisible();
  await expect(pill.getByRole("link", { name: "VAULT" })).toBeVisible();

  await page.goto("/vault");
  await expect(page).toHaveURL(/\/vault$/);
  expect((await page.request.get("/api/vault/search?q=x")).status()).toBe(200);
  await page.goto("/accounting");
  await expect(page).toHaveURL(/\/accounting$/);
});

test("an admin cannot take a module from HIMSELF — the boxes lock and the server refuses", async ({
  page,
}) => {
  await loginAsFounder(page);
  await page.goto("/b-systems/users");
  const me = page.getByRole("row", { name: /Elmur/ }).first();
  await me.getByRole("button", { name: "Edit" }).click();

  const modules = page.getByRole("group", { name: "Modules" });
  await expect(modules.getByRole("checkbox", { name: "Accounting" })).toBeDisabled();
  await expect(modules.getByRole("checkbox", { name: "Data Vault" })).toBeDisabled();
  await expect(
    page.getByText("You cannot take a module away from your own account", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  /* the lock is a courtesy — the RULE lives in updateUser and is proved against
     the service in src/lib/services/module-access.integration.test.ts. What
     matters here is that the founder's own access is intact and stays intact. */
  await expect(me.getByText("No Accounting")).toHaveCount(0);
  await expect(me.getByText("No Data Vault")).toHaveCount(0);
  expect((await page.request.get("/api/accounting/export?company=bsystems")).status()).toBe(200);
  expect((await page.request.get("/api/vault/search?q=x")).status()).toBe(200);
});

test("taking the module away bites the NEXT click — the blocked admin is not signed out", async ({
  page,
  browser,
}) => {
  /* two live sessions at once: the founder revokes while the other admin is
     already signed in and working */
  await login(page, ALLOWED_EMAIL, PASSWORD, /\/b-systems$/);
  await page.goto("/vault");
  await expect(page).toHaveURL(/\/vault$/);

  const founderCtx = await browser.newContext();
  const founderPage = await founderCtx.newPage();
  await loginAsFounder(founderPage);
  await founderPage.goto("/b-systems/users");
  await founderPage.getByRole("row", { name: /Rana Both/ }).getByRole("button", { name: "Edit" }).click();
  await founderPage
    .getByRole("group", { name: "Modules" })
    .getByRole("checkbox", { name: "Data Vault" })
    .uncheck();
  await founderPage.getByRole("button", { name: "Save user" }).click();
  await expect(founderPage.getByRole("row", { name: /Rana Both/ }).getByText("No Data Vault")).toBeVisible();

  /* the other admin never signed out and never signed back in */
  expect((await page.request.get("/api/vault/search?q=x")).status()).toBe(403);
  await page.goto("/vault");
  await page.waitForURL(/\/no-access\?module=vault/);
  /* still signed in, still an admin, still everything else */
  await page.goto("/b-systems/users");
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();

  await founderCtx.close();
});

import { expect, test, type Browser, type Page } from "@playwright/test";
import { afterSignIn } from "./helpers/after-sign-in";

/* ============================================================================
   Founder, 2026-11-15, verbatim:

     "add a way to mass assign leads to someone — I can choose them in the
      users section and select mass assign and select from the crms both crms"
                                                                  (ADR-105)
     "in the lead I don't see back to the crm button"            (ADR-106)

   Every account and lead here is made by this file, through the admin's own
   APIs, so the seeded people the other journeys count on keep their leads.
   ========================================================================== */

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await afterSignIn(page, landing);
}

async function adminPage(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  return page;
}

async function makeAccount(
  admin: Page,
  who: { name: string; email: string; password: string; roles: string[] },
): Promise<string> {
  const res = await admin.request.post("/api/b-systems/users", { data: who });
  expect(res.status(), `create ${who.email}`).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

async function makeLead(admin: Page, company: "b-systems" | "byteforce", name: string, number: string) {
  const res = await admin.request.post(`/api/${company}/leads`, {
    /* B-Systems asks for the company; ByteForce does not */
    data: { name, number, type: "cold_call", companyName: `${name} Ltd` },
  });
  expect(res.status(), `create ${name}`).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

test("the admin hands leads of BOTH CRMs to one person from Users — he has them, one bell, and Undo gives them back", async ({
  browser,
}) => {
  const admin = await adminPage(browser);
  const dualId = await makeAccount(admin, {
    name: "Mass Dual",
    email: "mass.dual@b-systems.example",
    password: "mass-dual-1",
    roles: ["bsystems_sales", "byteforce_staff"],
  });
  await makeLead(admin, "b-systems", "MassPick BS One", "0109994401");
  await makeLead(admin, "b-systems", "MassPick BS Two", "0109994402");
  await makeLead(admin, "byteforce", "MassPick BF One", "0109994403");

  /* the Users table: his row carries Assign leads */
  await admin.goto("/users");
  await admin.getByRole("row", { name: /Mass Dual/ }).getByRole("link", { name: "Assign leads" }).click();
  await admin.waitForURL(new RegExp(`/users\\?assign=${dualId}$`));
  await expect(admin.getByRole("heading", { level: 2, name: "Assign leads to Mass Dual" })).toBeVisible();
  /* both CRMs are on offer — he can own leads of both */
  /* by role: the wrapping label's text also holds the options, so getByLabel(exact) misses */
  await expect(admin.getByRole("combobox", { name: "CRM", exact: true })).toBeVisible();

  await admin.getByLabel("Search").fill("MassPick");
  await admin.getByRole("button", { name: "Apply" }).click();
  await admin.waitForURL(/q=MassPick/);
  for (const name of ["MassPick BS One", "MassPick BS Two", "MassPick BF One"]) {
    await expect(admin.getByRole("row", { name: new RegExp(name) })).toBeVisible();
  }
  await expect(admin.getByRole("row", { name: /MassPick BF One/ })).toContainText("ByteForce");

  await admin.getByLabel("Select every lead shown").check();
  await admin.getByRole("button", { name: "Assign 3 leads to Mass Dual" }).click();
  await expect(admin.getByRole("status").filter({ hasText: "3 leads are now Mass Dual's." })).toBeVisible();
  /* they are his now, so they leave the pile */
  await expect(admin.getByText("No leads match these filters.")).toBeVisible();
  const undo = admin.getByRole("button", { name: /Undo: Assigned 3 leads to Mass Dual/ });
  await expect(undo).toBeVisible();

  /* his side: both boards, and ONE bell for the three */
  const repCtx = await browser.newContext();
  const rep = await repCtx.newPage();
  await login(rep, "mass.dual@b-systems.example", "mass-dual-1", /\/b-systems\/crm$/);
  await rep.goto("/b-systems/crm?company=bsystems");
  await expect(rep.locator('[data-deal-card="MassPick BS One"]')).toBeVisible();
  await expect(rep.locator('[data-deal-card="MassPick BS Two"]')).toBeVisible();
  await rep.goto("/b-systems/crm?company=byteforce");
  await expect(rep.locator('[data-deal-card="MassPick BF One"]')).toBeVisible();
  const bell = (await (await rep.request.get("/api/b-systems/notifications")).json()) as Array<{ title: string }>;
  expect(bell.filter((n) => n.title.startsWith("Assigned to you")).map((n) => n.title)).toEqual([
    "Assigned to you: 3 leads",
  ]);

  /* one press back */
  await undo.click();
  await expect(admin.getByRole("alert").filter({ hasText: /Undone/ })).toBeVisible();
  await rep.goto("/b-systems/crm?company=bsystems");
  await expect(rep.locator('[data-deal-card="MassPick BS One"]')).toHaveCount(0);
  await admin.reload();
  await expect(admin.getByRole("row", { name: /MassPick BS One/ })).toBeVisible();

  await repCtx.close();
  await admin.context().close();
});

test("a person who cannot own leads has no Assign leads — and the address says why", async ({ browser }) => {
  const admin = await adminPage(browser);
  const entryId = await makeAccount(admin, {
    name: "Mass Entry Only",
    email: "mass.entry@b-systems.example",
    password: "mass-entry-1",
    roles: ["bsystems_data_entry"],
  });
  await admin.goto("/users");
  await expect(
    admin.getByRole("row", { name: /Mass Entry Only/ }).getByRole("link", { name: "Assign leads" }),
  ).toHaveCount(0);
  await admin.goto(`/users?assign=${entryId}`);
  await expect(admin.getByRole("alert").filter({ hasText: "Mass Entry Only can't be given leads" })).toBeVisible();
  await admin.context().close();
});

test("nobody but the admin mass assigns — not the page, not the API", async ({ browser, page }) => {
  const admin = await adminPage(browser);
  const sellerId = await makeAccount(admin, {
    name: "Mass Wall Seller",
    email: "mass.wall@b-systems.example",
    password: "mass-wall-1",
    roles: ["bsystems_sales"],
  });
  const leadId = await makeLead(admin, "b-systems", "MassWall Co", "0109994404");
  await admin.context().close();

  await login(page, "mass.wall@b-systems.example", "mass-wall-1", /\/b-systems\/crm$/);
  await page.goto(`/users?assign=${sellerId}`);
  await expect(page.getByRole("heading", { level: 1, name: "My account" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Assign leads to/ })).toHaveCount(0);
  const res = await page.request.post(`/api/users/${sellerId}/assign-leads`, { data: { leadIds: [leadId] } });
  expect(res.status()).toBe(403);
  /* still not his */
  await page.goto("/b-systems/crm?company=bsystems");
  await expect(page.locator('[data-deal-card="MassWall Co"]')).toHaveCount(0);
});

test("a lead's page has Back to the CRM board — in both companies", async ({ browser }) => {
  const admin = await adminPage(browser);
  const bs = await makeLead(admin, "b-systems", "BackLink BS Co", "0109994405");
  const bf = await makeLead(admin, "byteforce", "BackLink BF Co", "0109994406");

  await admin.goto(`/b-systems/crm/lead/${bs}?company=bsystems`);
  await admin.getByRole("link", { name: "Back to the CRM board" }).click();
  await admin.waitForURL(/\/b-systems\/crm\?company=bsystems$/);

  await admin.goto(`/b-systems/leads/lead/${bf}?company=byteforce`);
  await admin.getByRole("link", { name: "Back to the CRM board" }).click();
  await admin.waitForURL(/\/b-systems\/crm\?company=byteforce$/);
  await admin.context().close();
});

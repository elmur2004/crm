import { expect, test, type Page } from "@playwright/test";

/* ============================================================================
   ADR-067 — THE PROMISE TO EVERY OLD LINK.

   The ByteForce app shell is retired and its screens live in the merged CRM at
   /b-systems with ?company=byteforce. Every retired address must therefore
   land somewhere sensible: bookmarks, links already sent, and above all the
   WEB PUSHES ALREADY SITTING ON THE FOUNDER'S PHONE, whose payload URLs were
   baked at send time and cannot be rewritten.

   One test per rule. This file is the redirect map's proof of life, so it is
   its own file rather than a paragraph inside a board spec.
   ========================================================================== */

async function loginByteForce(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("sara@byteforce.example");
  await page.getByLabel("Password").fill("byteforce123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems\?company=byteforce$/);
}

/** A real seeded ByteForce lead, so the id-bearing rules are proved on a row
    that actually renders rather than on a shape. */
async function aByteForceLead(page: Page): Promise<{ id: string; name: string }> {
  const res = await page.request.get("/api/byteforce/leads");
  expect(res.status()).toBe(200);
  const leads = (await res.json()) as Array<{ id: string; name: string }>;
  expect(leads.length).toBeGreaterThan(0);
  return leads[0]!;
}

test("the five sections all land in the merged shell with ByteForce preselected", async ({
  page,
}) => {
  await loginByteForce(page);

  await page.goto("/byteforce");
  await expect(page).toHaveURL(/\/b-systems\?company=byteforce$/);
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();

  await page.goto("/byteforce/todo");
  await expect(page).toHaveURL(/\/b-systems\/todo\?company=byteforce$/);
  /* the ByteForce To-Do, not the B-Systems admin one: no assign controls */
  await expect(page.getByRole("button", { name: "Assign" })).toHaveCount(0);

  await page.goto("/byteforce/leads");
  await expect(page).toHaveURL(/\/b-systems\/leads\?company=byteforce$/);
  /* the REP DIRECTORY survived the merge — cards, not the B-Systems table */
  await expect(page.locator(".ecard").first()).toBeVisible();

  await page.goto("/byteforce/crm");
  await expect(page).toHaveURL(/\/b-systems\/crm\?company=byteforce$/);
  await expect(page.locator('[data-stage="new"]')).toBeVisible();
  /* six ByteForce columns — no Negotiation, which is a B-Systems stage */
  await expect(page.locator('[data-stage="negotiation"]')).toHaveCount(0);

  await page.goto("/byteforce/clients");
  await expect(page).toHaveURL(/\/b-systems\/clients\?company=byteforce$/);
  await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();
});

test("the rep drill-down keeps its id, its unassigned bucket and its archive tab", async ({
  page,
}) => {
  await loginByteForce(page);

  /* pick a real rep off the directory rather than guessing an id */
  await page.goto("/b-systems/leads?company=byteforce");
  const href = await page.locator('a.ecard[href*="/leads/rep/"]').first().getAttribute("href");
  const repId = href!.split("/leads/rep/")[1]!.split("?")[0]!;

  await page.goto(`/byteforce/leads/rep/${repId}`);
  await expect(page).toHaveURL(
    new RegExp(`/b-systems/leads/rep/${repId}\\?company=byteforce$`),
  );
  await expect(page.getByRole("link", { name: "Active" })).toHaveAttribute("aria-current", "page");

  /* the incoming query is MERGED, never replaced — the archive tab must still
     be the active one on arrival (ADR-043: this route is the only door to it) */
  await page.goto(`/byteforce/leads/rep/${repId}?view=archived`);
  await expect(page).toHaveURL(/company=byteforce/);
  await expect(page).toHaveURL(/view=archived/);
  await expect(page.getByRole("link", { name: "Archived" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  /* the Unassigned bucket is a literal repId, not a special case */
  await page.goto("/byteforce/leads/rep/unassigned");
  await expect(page).toHaveURL(/\/b-systems\/leads\/rep\/unassigned\?company=byteforce$/);
});

test("the lead deep link in every already-delivered push still opens that lead", async ({
  page,
}) => {
  await loginByteForce(page);
  const lead = await aByteForceLead(page);

  /* this is exactly the URL shape services/push/payload.ts used to emit, and
     which is now sitting in notifications the founder has already received */
  await page.goto(`/byteforce/leads/lead/${lead.id}`);
  await expect(page).toHaveURL(
    new RegExp(`/b-systems/leads/lead/${lead.id}\\?company=byteforce$`),
  );
  await expect(page.getByRole("heading", { name: lead.name })).toBeVisible();

  await page.goto(`/byteforce/leads/lead/${lead.id}/call`);
  await expect(page).toHaveURL(
    new RegExp(`/b-systems/leads/lead/${lead.id}/call\\?company=byteforce$`),
  );
  await expect(page.locator('a.call-cta[href^="tel:"]')).toBeVisible();
});

test("the board filters survive the redirect", async ({ page }) => {
  await loginByteForce(page);
  await page.goto("/byteforce/crm?q=Cairo+Textiles");
  await expect(page).toHaveURL(/company=byteforce/);
  await expect(page).toHaveURL(/q=Cairo\+Textiles/);
  /* and it is genuinely filtered, not merely carrying the parameter */
  await expect(page.locator('[data-deal-card="Cairo Textiles"]')).toBeVisible();
  await expect(page.locator('[data-deal-card="Cairo Logistics"]')).toHaveCount(0);
});

test("nothing under the retired prefix 404s, and sign-in stays consolidated", async ({ page }) => {
  await loginByteForce(page);
  for (const stale of [
    "/byteforce/nonsense",
    "/byteforce/leads/rep",
    "/byteforce/leads/lead",
    "/byteforce/crm/lead/whatever",
  ]) {
    const res = await page.goto(stale);
    expect(res?.status(), `${stale} must not 404`).toBe(200);
    await expect(page, stale).toHaveURL(/\/b-systems\?company=byteforce$/);
  }
});

test("an anonymous visitor following an old bookmark reaches sign-in, not a loop", async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto("/byteforce/login");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

  await page.goto("/byteforce/crm");
  await expect(page).toHaveURL(/\/login/);

  /* and signing in from there still puts a ByteForce teammate on her own CRM */
  await page.getByLabel("Email or phone").fill("sara@byteforce.example");
  await page.getByLabel("Password").fill("byteforce123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems\?company=byteforce$/);
  await ctx.close();
});

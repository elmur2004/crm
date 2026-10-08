import { expect, test, type Page } from "@playwright/test";

/* ============================================================================
   ADR-085 — ONE SEARCH BOX, BOTH COMPANIES.

   Founder: "I want the search to be valid across both crm so if I searched for
   something and it's not in bsystesm's crm but it's in byteforce's it will
   automatically switch to byteforce crm and it will show me the lead."

   The browser is the only place the whole thing is real: a search on one
   company's board, a REDIRECT, the other company's board, the card, and the
   sentence that says what just happened. None of that is visible to a unit
   test, and the redirect in particular is the part that could loop.
   ========================================================================== */

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

/* the filter form collapses behind a disclosure under 900px; at desktop width
   it is already open, so opening it is best-effort (the company-switch spec's
   own helper, same reason) */
async function openFilters(page: Page) {
  const toggle = page.getByRole("button", { name: "Filters" });
  if (await toggle.count()) await toggle.click();
}

async function searchFor(page: Page, q: string) {
  await openFilters(page);
  const box = page.getByPlaceholder("Name, company or number");
  await box.fill(q);
  await page.getByRole("button", { name: "Apply" }).click();
}

const UNIQUE = "Hopscotch Holdings";

test("a search with no match here lands on the other company, with the lead and a sentence", async ({
  page,
}) => {
  /* the founder holds both companies, so he is the one who can hop */
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);

  /* ---- give ByteForce a lead that B-Systems does not have ---- */
  await page.goto("/b-systems/crm?company=byteforce");
  await page.locator(".page-head .page-actions").getByRole("button", { name: "Add lead" }).click();
  const form = page.locator("form.card-pad");
  await form.getByLabel("Name").fill(UNIQUE);
  await form.getByLabel("Number").fill("01099988877");
  await form.getByLabel("Type").selectOption("cold_call");
  await form.getByRole("button", { name: "Save lead" }).click();
  await expect(page.locator(`[data-deal-card="${UNIQUE}"]`)).toBeVisible();

  /* ---- now search for it from the OTHER company's board ---- */
  await page.goto("/b-systems/crm?company=bsystems");
  await searchFor(page, UNIQUE);

  /* THE HOP: the URL is now ByteForce's, and it carries the search and the
     marker that records where he came from */
  await page.waitForURL(/company=byteforce/);
  const url = new URL(page.url());
  expect(url.searchParams.get("company")).toBe("byteforce");
  expect(url.searchParams.get("q")).toBe(UNIQUE);
  expect(url.searchParams.get("switched")).toBe("bsystems");

  /* "and it will show me the lead" */
  await expect(page.locator(`[data-deal-card="${UNIQUE}"]`)).toBeVisible();

  /* and the screen SAYS it moved — naming both companies and the search, so an
     automatic switch never reads as the app losing his place */
  const notice = page.locator(".alert-switched");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("B-Systems");
  await expect(notice).toContainText("ByteForce");
  await expect(notice).toContainText(UNIQUE);

  /* the chrome agrees with the URL — the switch is not left pointing at the
     company he came from (ADR-067's "no confusion in it") */
  await expect(page.locator(".company-switch-current")).toHaveText("ByteForce");

  /* ---- the way back, in one click, keeping his search ---- */
  await notice.getByRole("link", { name: /Back to B-Systems/ }).click();
  await page.waitForURL(/company=bsystems/);
  const back = new URL(page.url());
  expect(back.searchParams.get("q")).toBe(UNIQUE); // his search survives
  expect(page.locator(`[data-deal-card="${UNIQUE}"]`)).toHaveCount(0); // not here, as before

  /* AND IT DOES NOT BOUNCE. This board finds nothing for that search, so
     without the loop guard it would hop straight back to ByteForce and he could
     never return. He is still on B-Systems, and the notice is gone. */
  await expect(page.locator(".company-switch-current")).toHaveText("B-Systems");
  await expect(page.locator(".alert-switched")).toHaveCount(0);
});

test("a search that matches HERE never moves him", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  await page.goto("/b-systems/crm?company=bsystems");

  /* a lead the B-Systems board really has (the seed's own) */
  const first = page.locator("[data-deal-card]").first();
  await expect(first).toBeVisible();
  const name = (await first.getAttribute("data-deal-card"))!;

  await searchFor(page, name);
  await expect(page.locator(`[data-deal-card="${name}"]`)).toBeVisible();
  /* still B-Systems, and no notice: the search worked, so nothing happened */
  expect(new URL(page.url()).searchParams.get("company")).toBe("bsystems");
  await expect(page.locator(".alert-switched")).toHaveCount(0);
});

test("a search nobody matches leaves him where he is, and says nothing", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  await page.goto("/b-systems/crm?company=bsystems");
  await searchFor(page, "Zzz No Such Company Anywhere");

  expect(new URL(page.url()).searchParams.get("company")).toBe("bsystems");
  await expect(page.locator(".alert-switched")).toHaveCount(0);
  await expect(page.locator("[data-deal-card]")).toHaveCount(0);
});

/* ADR-067's own answer, inherited: a ByteForce-only teammate is LOCKED to
   ByteForce. There is nowhere to hop, and the search must behave exactly as it
   did before this feature — no redirect, no notice, no hint that another
   company has the row. */
test("a teammate locked to one company is never moved", async ({ page }) => {
  await login(page, "sara@byteforce.example", "byteforce123", /\/b-systems\?company=byteforce$/);
  await page.goto("/b-systems/crm?company=byteforce");
  await searchFor(page, "Zzz Nothing In ByteForce Either");

  expect(new URL(page.url()).searchParams.get("company")).toBe("byteforce");
  await expect(page.locator(".alert-switched")).toHaveCount(0);
});

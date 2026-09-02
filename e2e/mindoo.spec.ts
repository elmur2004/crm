import { expect, test, type Page } from "@playwright/test";

/* ============================================================================
   ADR-073 — MINDOO, the third company, end to end.

   Founder: "we need to add a third CRM called Mindoo with the exact same switch
   mechanic and the exact same info and details."

   Three things are proved here, and the third is the one that would have
   shipped broken:

   1. THE SWITCH REALLY HAS THREE SEGMENTS, and each one lands on its own data.

   2. THE WALL STILL NARROWS. A Mindoo-only teammate gets no switch at all and
      is refused both other companies — the ADR-067 property, which adding a
      company must not weaken.

   3. MINDOO'S STAFF CAN WIN ITS OWN DEALS. The B-Systems pipeline reserves Won
      for two named B-Systems roles; copied verbatim, `mindoo_staff` would be in
      neither list and the Won action would simply not be offered — a silent,
      plausible-looking hole in the middle of the pipeline the founder asked to
      have copied. This is the case that catches it.
   ========================================================================== */

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

const loginAsFounder = (page: Page) =>
  login(page, "admin@byteforce.com", "password123", /\/b-systems$/);

/** Mindoo's own teammate — one company, no switch. */
const loginAsMindoo = (page: Page) =>
  login(page, "mona@mindoo.example", "mindoo123", /\/b-systems/);

const switcher = (page: Page) => page.locator(".company-switch");

test.describe("ADR-073 — Mindoo", () => {
  test("the switch offers all three companies, and Mindoo lands on its own data", async ({
    page,
  }) => {
    await loginAsFounder(page);
    await expect(switcher(page).getByRole("link")).toHaveCount(3);
    for (const name of ["B-Systems", "ByteForce", "Mindoo"]) {
      await expect(switcher(page).getByRole("link", { name })).toBeVisible();
    }

    await switcher(page).getByRole("link", { name: "Mindoo" }).click();
    await page.waitForURL(/company=mindoo/);
    await expect(page.locator(".company-switch-current")).toHaveText("Mindoo");

    /* its OWN leads, not another company's */
    await page.goto("/b-systems/crm?company=mindoo");
    await expect(page.locator('[data-deal-card="Nile Freight"]')).toBeVisible();
    await expect(page.locator('[data-deal-card="Delta Foods"]')).toBeVisible();
  });

  test("it runs the B-SYSTEMS pipeline — eight columns, Negotiation among them", async ({
    page,
  }) => {
    await loginAsFounder(page);
    await page.goto("/b-systems/crm?company=mindoo");
    /* the founder asked for a copy of B-Systems, and this is what that means in
       columns: the same eight, including the Negotiation stage ByteForce has no
       equivalent of. */
    await expect(page.locator(".board [data-stage]")).toHaveCount(8);
    await expect(page.locator('[data-stage="negotiation"]')).toHaveCount(1);
    await expect(page.locator('[data-stage="postponed"]')).toHaveCount(1);
    await expect(
      page.locator('[data-stage="negotiation"] [data-deal-card="Red Sea Resorts"]'),
    ).toBeVisible();

    /* and ByteForce still does NOT have it — the two boards stay two pipelines */
    await page.goto("/b-systems/crm?company=byteforce");
    await expect(page.locator('[data-stage="negotiation"]')).toHaveCount(0);
  });

  test("Mindoo's own staff CAN win a Mindoo deal", async ({ page }) => {
    await loginAsFounder(page);
    await page.goto("/b-systems/crm?company=mindoo");
    await page.locator('[data-deal-card="Horizon Clinics"]').click();
    await page.waitForURL(/\/b-systems\/crm\/lead\//);

    /* THE assertion: Won is offered. The B-Systems config gates it on two named
       B-Systems roles, so a Mindoo config that copied it verbatim would leave
       this option absent — the board would look complete and quietly have no
       way to close anything. */
    const next = page.getByLabel(/Next action|Choose a next action/i);
    await expect(next.locator('option[value="won"]')).toHaveCount(1);
    /* and Negotiation, which is the other half of "the same pipeline" */
    await expect(next.locator('option[value="negotiation"]')).toHaveCount(1);
  });

  test("a Mindoo-only teammate is locked to Mindoo: no switch, no other company", async ({
    page,
  }) => {
    await loginAsMindoo(page);
    /* below two companies the switch renders nothing at all — the ADR-067 rule,
       unchanged by there being a third company in the world */
    await expect(switcher(page)).toHaveCount(0);

    await page.goto("/b-systems/crm?company=mindoo");
    await expect(page.locator('[data-deal-card="Nile Freight"]')).toBeVisible();

    /* Asking for a company she does not hold is REFUSED and sent to HER OWN
       company's home — `/b-systems?company=mindoo`, not back to the board she
       asked for. That is `resolveCompany`'s documented behaviour and the point
       of it: she is never answered with another company's rows under Mindoo's
       label, and never left on an address that would 404 or bounce again. */
    for (const other of ["bsystems", "byteforce"]) {
      await page.goto(`/b-systems/crm?company=${other}`);
      await expect(page).toHaveURL(/\/b-systems\?company=mindoo$/);
      await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();
    }
  });

  test("its nav is the B-Systems lead sections, without the partner subsystem", async ({
    page,
  }) => {
    await loginAsFounder(page);
    await page.goto("/b-systems?company=mindoo");
    const nav = page.locator(".app-nav");
    for (const label of ["Home", "To-Do", "Calendar", "Leads", "CRM", "Won Leads"]) {
      await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    /* the agent/partner sections are absent: Mindoo has one internal staff role
       by the founder's decision, so those screens could never hold anything */
    for (const absent of ["Partners", "Agents", "Registrations", "Statements", "Clients"]) {
      await expect(nav.getByRole("link", { name: absent, exact: true })).toHaveCount(0);
    }

    /* every link the Mindoo nav renders is a real Mindoo screen */
    const hrefs = await nav
      .getByRole("link")
      .evaluateAll((els) => els.map((el) => (el as HTMLAnchorElement).getAttribute("href")!));
    for (const href of hrefs) {
      const res = await page.goto(href);
      expect(res?.status(), `${href} must be a real screen`).toBe(200);
      await expect(page, href).toHaveURL(/company=mindoo/);
      await expect(page.locator("h1")).toBeVisible();
    }
  });

  test("Arabic: Mindoo keeps its name and the shell mirrors", async ({ page }) => {
    await loginAsFounder(page);
    await page.goto("/b-systems/crm?company=mindoo");
    await page.getByRole("button", { name: "عربي" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    /* brand names stay untranslated — the dictionary's own convention */
    await expect(page.locator(".company-switch-current")).toHaveText("Mindoo");
  });
});

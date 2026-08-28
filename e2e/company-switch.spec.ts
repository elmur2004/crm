import { expect, test, type Page } from "@playwright/test";

/* the filter sidebar collapses behind a "Filters" disclosure only under 900px;
   at desktop width the form is already open, so opening it is best-effort */
async function openFilters(page: Page) {
  const toggle = page.getByRole("button", { name: "Filters" });
  if (await toggle.count()) await toggle.click();
}

/* ============================================================================
   ADR-067 — ONE CRM, TWO COMPANIES.

   Founder: "I can have a switch button between b systems and byte force, and
   the entire boards change accordingly... make sure that this is there, and
   there is no confusion in it." And, asked who a ByteForce-only teammate is:
   "SAME APP, LOCKED TO BYTEFORCE... Nobody gains access they do not have
   today."

   So this file proves three things, per role: the switch is there and legible
   for whoever may switch; the company survives navigation and every filter
   form; and the server — never the UI — is what refuses a company or a section
   an account does not hold.
   ========================================================================== */

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

const switcher = (page: Page) => page.getByRole("group", { name: "Switch company" });

/* ---------------------------------------------------------------- BOTH ---- */

test("the founder switches company, and the CHROME never changes with it", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);

  /* the current company is stated in WORDS, not carried by colour alone */
  await expect(page.locator(".company-switch-current")).toHaveText("B-Systems");
  await expect(switcher(page).getByRole("link", { name: "B-Systems" })).toHaveAttribute(
    "aria-current",
    "true",
  );

  const skin = async () => ({
    brand: await page.locator("html").getAttribute("data-brand"),
    wordmark: await page.locator(".app-header .wordmark").textContent(),
    header: await page.locator(".app-header").evaluate((el) => getComputedStyle(el).backgroundColor),
  });
  const before = await skin();

  await switcher(page).getByRole("link", { name: "ByteForce" }).click();
  await page.waitForURL(/\/b-systems\?company=byteforce$/);
  await expect(page.locator(".company-switch-current")).toHaveText("ByteForce");

  /* THE DATA changed; the skin did not. "I don't need the entire interface to
     change. I don't want it." */
  expect(await skin()).toEqual(before);
  await expect(page.getByText("BYTEFORCE ·", { exact: false })).toBeVisible();
});

test("the nav ADAPTS per company, and no rendered nav link 404s or shows the other company", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);

  /* B-Systems: its own sections are there, ByteForce's Clients is not */
  const nav = page.locator(".app-nav");
  await page.goto("/b-systems?company=bsystems");
  for (const label of ["Won Leads", "Partners", "Agents", "Registrations", "Statements", "Users"]) {
    await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: "Clients", exact: true })).toHaveCount(0);

  /* ByteForce: exactly its five, and none of the B-Systems-only sections */
  await page.goto("/b-systems?company=byteforce");
  await expect(nav.getByRole("link")).toHaveCount(5);
  await expect(nav.getByRole("link", { name: "Clients", exact: true })).toBeVisible();
  for (const label of ["Won Leads", "Partners", "Agents", "Registrations", "Statements", "Users"]) {
    await expect(nav.getByRole("link", { name: label, exact: true })).toHaveCount(0);
  }

  /* every link the ByteForce nav DOES render must be a real, ByteForce screen */
  const hrefs = await nav.getByRole("link").evaluateAll((els) =>
    els.map((el) => (el as HTMLAnchorElement).getAttribute("href")!),
  );
  for (const href of hrefs) {
    const res = await page.goto(href);
    expect(res?.status(), `${href} must be a real screen`).toBe(200);
    await expect(page, href).toHaveURL(/company=byteforce/);
    await expect(page.locator("h1")).toBeVisible();
  }
});

test("the company survives navigation, filters and the back button", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  await page.goto("/b-systems/crm?company=byteforce");

  /* THE confusion bug this merge could have shipped: a plain method="get"
     filter form REPLACES the whole query string on submit. Applying a filter on
     the ByteForce board must not throw the founder back to B-Systems. */
  await openFilters(page);
  await page.getByRole("searchbox").first().fill("Cairo Textiles");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.waitForURL(/q=Cairo\+Textiles/);
  await expect(page).toHaveURL(/company=byteforce/);
  await expect(page.locator('[data-deal-card="Cairo Textiles"]')).toBeVisible();

  /* and clicking through the nav keeps it too */
  const nav = page.locator(".app-nav");
  await nav.getByRole("link", { name: "Leads", exact: true }).click();
  await page.waitForURL(/\/b-systems\/leads\?company=byteforce$/);
  await nav.getByRole("link", { name: "To-Do", exact: true }).click();
  await page.waitForURL(/\/b-systems\/todo\?company=byteforce$/);

  await page.goBack();
  await expect(page).toHaveURL(/company=byteforce/);
  await page.goBack();
  await expect(page).toHaveURL(/company=byteforce/);
});

test("the B-Systems filter form keeps its company too", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  await page.goto("/b-systems/leads?company=bsystems");
  await openFilters(page);
  await page.getByRole("searchbox").first().fill("Delta Textiles");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.waitForURL(/q=Delta\+Textiles/);
  await expect(page).toHaveURL(/company=bsystems/);
});

/* ------------------------------------------------------- LOCKED ACCOUNTS -- */

test("a ByteForce-only teammate: same app, locked to ByteForce, no switch", async ({ page }) => {
  await login(page, "sara@byteforce.example", "byteforce123", /\/b-systems\?company=byteforce$/);

  /* he lands on the ByteForce dashboard, in the one merged shell */
  await expect(page.getByText("BYTEFORCE ·", { exact: false })).toBeVisible();
  await expect(switcher(page)).toHaveCount(0);
  /* the role line names him honestly rather than borrowing a B-Systems label */
  await expect(page.locator(".user-role")).toHaveText("ByteForce staff");

  /* asking for the other company is refused BY THE SERVER, on every screen */
  for (const path of ["/b-systems", "/b-systems/crm", "/b-systems/todo", "/b-systems/leads"]) {
    await page.goto(`${path}?company=bsystems`);
    await expect(page, path).toHaveURL(/company=byteforce/);
  }
  await page.goto("/b-systems/crm?company=bsystems");
  await expect(page.locator('[data-stage="negotiation"]')).toHaveCount(0);
  await expect(page.locator('[data-deal-card="Delta Textiles"]')).toHaveCount(0);
});

test("a B-Systems-only rep: locked to B-Systems, no switch, no ByteForce screen", async ({
  page,
}) => {
  await login(page, "omar@b-systems.example", "bsystems123", /\/b-systems\/crm/);
  await expect(switcher(page)).toHaveCount(0);

  /* the ByteForce-only routes do not exist for him — and none of them errors */
  for (const path of [
    "/b-systems/clients",
    "/b-systems/leads/rep/unassigned",
    "/b-systems/crm?company=byteforce",
  ]) {
    const res = await page.goto(path);
    expect(res?.status(), `${path} must refuse without erroring`).toBe(200);
    await expect(page, path).not.toHaveURL(/company=byteforce/);
  }
  expect((await page.request.post("/api/byteforce/reps", { data: { name: "x" } })).status()).toBe(
    403,
  );
});

test("the data-entry role still has exactly one destination, either company", async ({ page }) => {
  await login(page, "entry@b-systems.example", "entry123", /\/b-systems\/entry/);
  await expect(switcher(page)).toHaveCount(0);
  await expect(page.locator(".app-nav").getByRole("link")).toHaveCount(1);
  for (const path of ["/b-systems/entry?company=byteforce", "/b-systems/crm?company=byteforce"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page, path).toHaveURL(/\/b-systems\/entry/);
  }
});

/* ------------------------------------------------------------------ RTL --- */

test("Arabic: the switch mirrors, keeps its words, and stays legible", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  await page.getByRole("button", { name: "عربي" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.goto("/b-systems?company=byteforce");

  await expect(page.getByRole("group", { name: "تبديل الشركة" })).toBeVisible();
  await expect(page.locator(".company-switch-current")).toHaveText("ByteForce");
  /* the first DOM segment renders at the inline START, which is the RIGHT */
  const xs = await page
    .locator(".company-switch .switcher-seg")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().x));
  expect(xs[0]!).toBeGreaterThan(xs[xs.length - 1]!);

  for (const width of [320, 390, 601, 820]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/b-systems/crm?company=byteforce");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `overflow at ${width}px`).toBeLessThanOrEqual(1);
  }
});

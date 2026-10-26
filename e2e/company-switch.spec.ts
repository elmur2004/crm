import { expect, test, type Page } from "@playwright/test";
import { afterSignIn, LAUNCHER_URL } from "./helpers/after-sign-in";

/* the filter sidebar collapses behind a "Filters" disclosure only under 900px;
   at desktop width the form is already open, so opening it is best-effort */
async function openFilters(page: Page) {
  const toggle = page.getByRole("button", { name: "Filters" });
  if (await toggle.count()) await toggle.click();
}

/* ============================================================================
   TWO CRM APPS, NO COMPANY SWITCH.

   ADR-067 merged the two CRMs into one shell with a company switch. The
   founder has since asked for ONE way to each page, and answered: "Two CRM
   icons, no switch" — ByteForce CRM and B-Systems CRM are two launcher tiles,
   and the switch inside the CRM is gone. This file used to prove the switch;
   it now proves the switch is GONE and that what it did is still done:

     · which company you are in is the tile you opened, and the header SAYS it,
       in words ("ByteForce CRM" / "B-Systems CRM") — the job the switch's label
       used to do;
     · the CHROME is the same in both (ADR-067: switching company changes the
       data, never the skin);
     · the company survives navigation, every filter form and the back button;
     · the server — never the UI — refuses a company or a section an account
       does not hold;
     · the To-Do, one page for both companies, carries company TABS — a filter
       on that page, not a way to another.

   The cross-company SEARCH hop (ADR-085) is automatic, not a menu, and stays:
   e2e/search-cross-company.spec.ts.
   ========================================================================== */

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await afterSignIn(page, landing);
}

const switcher = (page: Page) => page.getByRole("group", { name: "Switch company" });
const appName = (page: Page) => page.locator(".app-header .app-name");
const menu = (page: Page) => page.locator(".app-header .app-nav");

/* ---------------------------------------------------------------- BOTH ---- */

test("the founder opens each CRM from its own tile — no switch, the header names it, the chrome never changes", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems\/crm$/);

  const skin = async () => ({
    brand: await page.locator("html").getAttribute("data-brand"),
    header: await page.locator(".app-header").evaluate((el) => getComputedStyle(el).backgroundColor),
  });

  await page.goto("/apps");
  await page.locator('[data-app="crm-bsystems"]').click();
  await page.waitForURL(/\/b-systems\/crm\?company=bsystems$/);
  await expect(appName(page)).toHaveText("B-Systems CRM");
  await expect(switcher(page)).toHaveCount(0);
  const before = await skin();

  /* the way to the OTHER company is the launcher — the one way between apps */
  await page.getByRole("link", { name: "All apps" }).click();
  await page.waitForURL(LAUNCHER_URL);
  await page.locator('[data-app="crm-byteforce"]').click();
  await page.waitForURL(/\/b-systems\/crm\?company=byteforce$/);
  await expect(appName(page)).toHaveText("ByteForce CRM");
  await expect(switcher(page)).toHaveCount(0);

  /* THE DATA changed; the skin did not. "I don't need the entire interface to
     change. I don't want it." */
  expect(await skin()).toEqual(before);
  await expect(page.locator('[data-deal-card="Cairo Textiles"]')).toBeVisible();
});

test("no screen of the shell carries a company switch, for either company", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems\/crm$/);
  for (const company of ["bsystems", "byteforce"]) {
    for (const path of [
      "/b-systems",
      "/b-systems/crm",
      "/b-systems/leads",
      "/b-systems/calendar",
      "/b-systems/todo",
      "/b-systems/daily-report",
    ]) {
      await page.goto(`${path}?company=${company}`);
      await expect(page.locator("h1").first(), `${path} ${company}`).toBeVisible();
      await expect(switcher(page), `${path} ${company}`).toHaveCount(0);
      await expect(page.locator(".company-switch"), `${path} ${company}`).toHaveCount(0);
    }
  }
});

test("each CRM has its OWN menu, and no rendered menu link 404s or shows the other company", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems\/crm$/);

  /* B-Systems CRM (admin): exactly its six — Home, the To-Do, the Daily report
     and the Partners & Agents screens are other apps now */
  await page.goto("/b-systems/crm?company=bsystems");
  await expect(menu(page).getByRole("link")).toHaveText([
    "CRM",
    "Leads",
    "Calendar",
    "Won Leads",
    "Statements",
    "Users",
  ]);

  /* ByteForce CRM: exactly its four, and none of the B-Systems-only sections */
  await page.goto("/b-systems/crm?company=byteforce");
  await expect(menu(page).getByRole("link")).toHaveText(["CRM", "Leads", "Calendar", "Clients"]);

  /* every link the ByteForce menu DOES render must be a real, ByteForce screen */
  const hrefs = await menu(page)
    .getByRole("link")
    .evaluateAll((els) => els.map((el) => (el as HTMLAnchorElement).getAttribute("href")!));
  for (const href of hrefs) {
    const res = await page.goto(href);
    expect(res?.status(), `${href} must be a real screen`).toBe(200);
    await expect(page, href).toHaveURL(/company=byteforce/);
    await expect(page.locator("h1")).toBeVisible();
    await expect(appName(page), href).toHaveText("ByteForce CRM");
  }
});

test("the company survives navigation, filters and the back button", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems\/crm$/);
  await page.goto("/b-systems/crm?company=byteforce");

  /* THE confusion bug the merge could have shipped: a plain method="get"
     filter form REPLACES the whole query string on submit. Applying a filter on
     the ByteForce board must not throw the founder back to B-Systems. */
  await openFilters(page);
  await page.getByRole("searchbox").first().fill("Cairo Textiles");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.waitForURL(/q=Cairo\+Textiles/);
  await expect(page).toHaveURL(/company=byteforce/);
  await expect(page.locator('[data-deal-card="Cairo Textiles"]')).toBeVisible();

  /* and clicking through the menu keeps it too */
  await menu(page).getByRole("link", { name: "Leads", exact: true }).click();
  await page.waitForURL(/\/b-systems\/leads\?company=byteforce$/);
  await menu(page).getByRole("link", { name: "Calendar", exact: true }).click();
  await page.waitForURL(/\/b-systems\/calendar\?company=byteforce$/);
  await expect(appName(page)).toHaveText("ByteForce CRM");

  await page.goBack();
  await expect(page).toHaveURL(/company=byteforce/);
  await page.goBack();
  await expect(page).toHaveURL(/company=byteforce/);
});

test("the B-Systems filter form keeps its company too", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems\/crm$/);
  await page.goto("/b-systems/leads?company=bsystems");
  await openFilters(page);
  await page.getByRole("searchbox").first().fill("Delta Textiles");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.waitForURL(/q=Delta\+Textiles/);
  await expect(page).toHaveURL(/company=bsystems/);
});

/* ------------------------------------------------------- the To-Do's tabs - */

test("the To-Do: one page for both companies, with company TABS — a filter, not a way out", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems\/crm$/);
  await page.goto("/apps");
  await page.locator('[data-app="todo"]').click();
  await page.waitForURL(/\/b-systems\/todo\?company=bsystems$/);

  /* its own app: no menu around it, and the header says so */
  await expect(appName(page)).toHaveText("To-Do");
  await expect(menu(page)).toHaveCount(0);

  const tabs = page.getByRole("group", { name: "Company" });
  await expect(tabs.getByRole("link")).toHaveText(["ByteForce", "B-Systems"]);
  /* the current company is stated in WORDS, not carried by the pill alone */
  await expect(page.locator(".company-tabs-current")).toHaveText("B-Systems");
  await expect(tabs.getByRole("link", { name: "B-Systems" })).toHaveAttribute("aria-current", "true");

  await tabs.getByRole("link", { name: "ByteForce" }).click();
  /* the SAME page, the other company */
  await page.waitForURL(/\/b-systems\/todo\?company=byteforce$/);
  await expect(page.locator(".company-tabs-current")).toHaveText("ByteForce");
  await expect(tabs.getByRole("link", { name: "ByteForce" })).toHaveAttribute("aria-current", "true");
  await expect(appName(page)).toHaveText("To-Do");
});

/* ------------------------------------------------------- LOCKED ACCOUNTS -- */

test("a ByteForce-only teammate: his own CRM, locked to ByteForce, no switch, no To-Do tabs", async ({ page }) => {
  await login(page, "sara@byteforce.example", "byteforce123", /\/b-systems\?company=byteforce$/);

  /* his dashboard opens from Reports & Dashboards, in the one merged shell */
  await expect(page.getByText("BYTEFORCE ·", { exact: false })).toBeVisible();
  await expect(switcher(page)).toHaveCount(0);
  /* the role line names him honestly rather than borrowing a B-Systems label */
  await expect(page.locator(".user-role")).toHaveText("ByteForce staff");

  await page.goto("/b-systems/crm?company=byteforce");
  await expect(appName(page)).toHaveText("ByteForce CRM");
  await page.goto("/b-systems/todo?company=byteforce");
  await expect(page.getByRole("group", { name: "Company" })).toHaveCount(0);

  /* asking for the other company is refused BY THE SERVER, on every screen */
  for (const path of ["/b-systems", "/b-systems/crm", "/b-systems/todo", "/b-systems/leads"]) {
    await page.goto(`${path}?company=bsystems`);
    await expect(page, path).toHaveURL(/company=byteforce/);
  }
  await page.goto("/b-systems/crm?company=bsystems");
  await expect(page.locator('[data-stage="negotiation"]')).toHaveCount(0);
  await expect(page.locator('[data-deal-card="Delta Textiles"]')).toHaveCount(0);
});

test("a B-Systems-only rep: locked to B-Systems, no switch, no ByteForce screen", async ({ page }) => {
  await login(page, "omar@b-systems.example", "bsystems123", /\/b-systems\/crm/);
  await expect(switcher(page)).toHaveCount(0);
  await expect(appName(page)).toHaveText("B-Systems CRM");

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
  expect((await page.request.post("/api/byteforce/reps", { data: { name: "x" } })).status()).toBe(403);
});

test("the data-entry role has exactly one page and NO menu, either company", async ({ page }) => {
  await login(page, "entry@b-systems.example", "entry123", /\/b-systems\/entry/);
  await expect(switcher(page)).toHaveCount(0);
  /* one page, reached from its one tile — a one-item menu would be a second
     way to it */
  await expect(page.locator(".app-header .app-nav")).toHaveCount(0);
  await expect(page.locator(".app-header .nav-item[href]")).toHaveCount(0);
  for (const path of ["/b-systems/entry?company=byteforce", "/b-systems/crm?company=byteforce"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page, path).toHaveURL(/\/b-systems\/entry/);
  }
});

/* ------------------------------------------------------------------ RTL --- */

test("Arabic: the header names the app in Arabic, the To-Do tabs mirror, and nothing scrolls sideways", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems\/crm$/);
  await page.getByRole("button", { name: "عربي" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  await page.goto("/b-systems/crm?company=byteforce");
  await expect(appName(page)).toHaveText("إدارة عملاء ByteForce");

  await page.goto("/b-systems/todo?company=byteforce");
  const tabs = page.getByRole("group", { name: "الشركة" });
  await expect(tabs).toBeVisible();
  await expect(page.locator(".company-tabs-current")).toHaveText("ByteForce");
  /* the first DOM tab renders at the inline START, which is the RIGHT */
  const xs = await page
    .locator(".company-tabs .switcher-seg")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().x));
  expect(xs[0]!).toBeGreaterThan(xs[xs.length - 1]!);

  for (const width of [320, 390, 601, 820]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ["/b-systems/crm?company=byteforce", "/b-systems/todo?company=byteforce"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} overflow at ${width}px`).toBeLessThanOrEqual(1);
    }
    /* the tabs are thumb targets on a phone */
    if (width <= 820) {
      for (const box of await page
        .locator(".company-tabs .switcher-seg")
        .evaluateAll((els) => els.map((el) => el.getBoundingClientRect()))) {
        /* 44px, read off a sub-pixel layout (a grid cell measures 43.99999) */
        expect(box.height, `tab height at ${width}px`).toBeGreaterThanOrEqual(43.5);
      }
    }
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "EN", exact: true }).first().click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

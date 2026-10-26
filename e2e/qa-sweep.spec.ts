import { expect, test, type Page } from "@playwright/test";
import { afterSignIn } from "./helpers/after-sign-in";

/* §15 Global DoD sweep, V2 edition: no console errors; no horizontal overflow
   on every major screen, per role. 601 is deliberate (ADR-060): the four-
   segment header switcher overflowed by a measured +44px in the ~601–645px
   band, exactly BETWEEN the old sampled widths — the switcher is gone (one way
   to each page), and the sweep still stands on the band, because the header's
   app name now lives there. */

const VIEWPORTS = [1440, 1024, 768, 601, 560, 390];

function collectErrors(page: Page, sink: string[]) {
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (text.includes("favicon")) return; // ByteForce mark not yet supplied (A-13)
    sink.push(text);
  });
  page.on("pageerror", (err) => sink.push(String(err)));
}

async function sweep(page: Page, errors: string[], paths: string[]) {
  for (const path of paths) {
    for (const width of VIEWPORTS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      /* networkidle is the right settle signal, but a Link prefetch canceled
         by the next navigation can wedge Chromium's in-flight counter so the
         event never fires even on a silent network (seen on the accounting
         module's query-carrying nav links). Bound the wait: the genuine quiet
         case fires in <1s; the wedged case proceeds — console errors are
         still collected by the listeners and fail the test on their own. */
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} overflows horizontally at ${width}px`).toBeLessThanOrEqual(1);
    }
  }
}

test("ByteForce screens (in the merged shell): clean console, no horizontal overflow", async ({
  page,
}) => {
  test.setTimeout(190_000); // 6 paths × 6 widths (ADR-071 the calendar, ADR-081 the daily report)
  const errors: string[] = [];
  collectErrors(page, errors);
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("sara@byteforce.example");
  await page.getByLabel("Password").fill("byteforce123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await afterSignIn(page, /\/b-systems\?company=byteforce$/);
  await sweep(page, errors, [
    "/b-systems?company=byteforce",
    "/b-systems/leads?company=byteforce",
    "/b-systems/crm?company=byteforce",
    "/b-systems/clients?company=byteforce",
    /* ADR-071 — a seven-column grid is the likeliest page in the product to
       push the body sideways, so it earns its place in the sweep */
    "/b-systems/calendar?company=byteforce",
    /* ADR-081 — three number tiles plus a wrapping row of name + company badge
       + count, which is the other shape that can push the body sideways */
    "/b-systems/daily-report?company=byteforce",
  ]);
  expect(errors).toEqual([]);
});

test("B-Systems admin: all twelve screens of the shell clean at every width", async ({ page }) => {
  /* 12 paths × 6 widths = 72 page loads. This case had always run on the
     DEFAULT 60s while its two siblings below carry explicit 240s and 210s for
     strictly less work — it passed only because these pages are quicker than
     the accounting and vault ones, and it timed out at 1.1m once the header
     grew one more nav item. The budget is now stated, like theirs, and it grows
     with the list (ADR-081 added the twelfth). */
  test.setTimeout(340_000);
  const errors: string[] = [];
  collectErrors(page, errors);
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await afterSignIn(page, /\/b-systems$/);
  await sweep(page, errors, [
    "/b-systems",
    "/b-systems/leads",
    "/b-systems/crm",
    "/b-systems/won-leads",
    "/b-systems/partners-pipeline",
    "/b-systems/partners",
    "/b-systems/agents",
    "/b-systems/registrations",
    "/b-systems/statements",
    "/b-systems/users",
    "/b-systems/calendar", // ADR-071
    "/b-systems/daily-report", // ADR-081
  ]);
  expect(errors).toEqual([]);
});

test("B-Systems internal sales: CRM + Won Leads clean", async ({ page }) => {
  const errors: string[] = [];
  collectErrors(page, errors);
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("omar@b-systems.example");
  await page.getByLabel("Password").fill("bsystems123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await afterSignIn(page, /\/b-systems\/crm$/);
  await sweep(page, errors, ["/b-systems/crm", "/b-systems/won-leads"]);
  expect(errors).toEqual([]);
});

/* ADR-051 — the data-entry role's single page has two tables and two modals of
   its own, so it gets the same width + console treatment as every other screen. */
test("B-Systems data entry: its one page clean at every width", async ({ page }) => {
  const errors: string[] = [];
  collectErrors(page, errors);
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("entry@b-systems.example");
  await page.getByLabel("Password").fill("entry123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await afterSignIn(page, /\/b-systems\/entry$/);
  await sweep(page, errors, ["/b-systems/entry"]);
  expect(errors).toEqual([]);
});

/* ADR-052 — the accounting module's twelve screens (media only under the
   ByteForce filter; the dashboard also swept under the B-Systems filter,
   where Media Buying must be absent) at every width. */
test("B-Systems admin: accounting screens clean at every width", async ({ page }) => {
  test.setTimeout(240_000); // 13 paths × 5 widths, plus dev-mode first-hit compiles
  const errors: string[] = [];
  collectErrors(page, errors);
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await afterSignIn(page, /\/b-systems$/);
  await sweep(page, errors, [
    "/accounting",
    "/accounting?company=bsystems",
    "/accounting/income",
    "/accounting/expenses",
    "/accounting/clients",
    "/accounting/roster",
    "/accounting/media",
    "/accounting/loans",
    "/accounting/treasury",
    "/accounting/report",
    "/accounting/departments",
    "/accounting/targets",
    "/accounting/import",
  ]);
  expect(errors).toEqual([]);
});

/* ADR-053 — the vault's eight screens at every width (ADR-070 added Links). */
test("B-Systems admin: vault screens clean at every width", async ({ page }) => {
  test.setTimeout(210_000); // 8 paths × 5 widths, plus dev-mode first-hit compiles
  const errors: string[] = [];
  collectErrors(page, errors);
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await afterSignIn(page, /\/b-systems$/);
  await sweep(page, errors, [
    "/vault",
    "/vault/forms",
    "/vault/links",
    "/vault/sheets",
    "/vault/documents",
    "/vault/tasks",
    "/vault/employees",
    "/vault/archive",
  ]);
  expect(errors).toEqual([]);
});

/* ONE WAY TO EACH PAGE — each app of the shell carries ITS menu, and on a phone
   the burger sheet is that menu: every section of the app, then the language,
   the theme and Log out. There is no module strip in it any more (the launcher
   is the one way between apps) and no company switch (each CRM is its own
   launcher app). */
test("mobile menu reaches EVERY section of each app at 390px — and only that app's", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await afterSignIn(page, /\/b-systems\/crm$/);
  await page.setViewportSize({ width: 390, height: 844 });

  const sheetLinks = () => page.getByRole("menu").locator(".nav-sheet-link");
  for (const [path, labels] of [
    ["/b-systems/crm?company=bsystems", ["CRM", "Leads", "Calendar", "Won Leads", "Statements", "Users"]],
    ["/b-systems/crm?company=byteforce", ["CRM", "Leads", "Calendar", "Clients"]],
    ["/b-systems/partners-pipeline?company=bsystems", ["Pipeline", "Partners", "Agents", "Registrations"]],
    /* the To-Do and the Reports pages are one-page apps: the sheet has no rows */
    ["/b-systems/todo?company=bsystems", []],
    ["/b-systems?company=bsystems", []],
    ["/b-systems/daily-report?company=bsystems", []],
  ] as const) {
    await page.goto(path);
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    /* the sheet unfolds (motion.css mo-sheet, ~240 ms) and its rows rise in:
       measure the thumb targets AT REST — a box read mid-translate comes back
       a float hair short (43.99998 for a 44px segment) */
    await page
      .getByRole("menu")
      .evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
    await expect(sheetLinks(), path).toHaveText([...labels]);
    await expect(page.getByRole("menu").getByRole("button", { name: "Log out" })).toBeVisible();
    await expect(page.getByRole("menu").getByRole("group", { name: "Switch module" })).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Switch company" })).toHaveCount(0);
    /* every switcher segment in the sheet is a real thumb target — BOTH axes
       (the language toggle's EN segment is the narrow one) */
    for (const box of await page
      .getByRole("menu")
      .locator(".switcher-seg")
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect()))) {
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole("button", { name: "Close menu" }).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
  }
  await page.goto("/b-systems/crm?company=bsystems");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("menu").getByRole("link", { name: "Statements", exact: true }).click();
  /* ADR-067 — every menu href in the merged shell spells the company out */
  await page.waitForURL(/\/b-systems\/statements\?company=bsystems$/);
});

/* ADR-054 made Accounting and the Data Vault switcher peers of the CRM, and
   ADR-067 added a company switch beside it. Both are gone: the founder asked
   for ONE way to each page, and the launcher is the one way between apps. So
   one admin session walks every app through the LAUNCHER — each tile opens its
   app, the header names it, no header carries a switch, and the grid icon is
   the way back. The chrome of the two CRMs is one skin (ADR-067). */
test("the launcher moves between every app; no header carries a module or company switch", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await afterSignIn(page, /\/b-systems\/crm$/);

  const noSwitches = async (where: string) => {
    await expect(page.getByRole("group", { name: "Switch module" }), where).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Switch company" }), where).toHaveCount(0);
  };

  for (const [tile, url, heading] of [
    ["accounting", /\/accounting$/, "Dashboard"],
    ["vault", /\/vault$/, "Overview"],
  ] as const) {
    await page.goto("/apps");
    await page.locator(`[data-app="${tile}"]`).click();
    await page.waitForURL(url);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await noSwitches(tile);
    /* the menu's first item is the page the tile opened */
    await expect(page.locator(".app-nav .nav-item").first()).toHaveAttribute("aria-current", "page");
  }

  for (const [tile, name] of [
    ["crm-bsystems", "B-Systems CRM"],
    ["crm-byteforce", "ByteForce CRM"],
    ["partners", "Partners & Agents"],
  ] as const) {
    await page.getByRole("link", { name: "All apps" }).click();
    await page.waitForURL(/\/apps$/);
    await page.locator(`[data-app="${tile}"]`).click();
    await expect(page.locator(".app-header .app-name")).toHaveText(name);
    await noSwitches(tile);
    await expect(page.locator(".app-nav .nav-item").first()).toHaveAttribute("aria-current", "page");
    /* the CHROME did not change — same brand scope in every app of the shell */
    await expect(page.locator("html")).toHaveAttribute("data-brand", "bsystems");
  }
});

test("B-Systems agent + public screens: clean console, no horizontal overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  collectErrors(page, errors);
  await sweep(page, errors, ["/", "/login", "/portal", "/portal/signup"]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("01001234567");
  await page.getByLabel("Password").fill("partner123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await afterSignIn(page, /\/b-systems\/crm$/);
  await sweep(page, errors, [
    "/b-systems/crm",
    "/b-systems/won-leads",
    "/b-systems/payments",
    "/b-systems/profile",
  ]);
  expect(errors).toEqual([]);
});

import { expect, test, type Page } from "@playwright/test";

/* §15 Global DoD sweep, V2 edition: no console errors; no horizontal overflow
   on every major screen, per role. 601 is deliberate (ADR-060): the four-
   segment header switcher overflowed by a measured +44px in the ~601–645px
   band, exactly BETWEEN the old sampled widths — this sweep now stands on it. */

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
  const errors: string[] = [];
  collectErrors(page, errors);
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("sara@byteforce.example");
  await page.getByLabel("Password").fill("byteforce123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems\?company=byteforce$/);
  await sweep(page, errors, ["/b-systems?company=byteforce", "/b-systems/leads?company=byteforce", "/b-systems/crm?company=byteforce", "/b-systems/clients?company=byteforce"]);
  expect(errors).toEqual([]);
});

test("B-Systems admin: all ten sections clean at every width", async ({ page }) => {
  const errors: string[] = [];
  collectErrors(page, errors);
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);
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
  await page.waitForURL(/\/b-systems\/crm$/);
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
  await page.waitForURL(/\/b-systems\/entry$/);
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
  await page.waitForURL(/\/b-systems$/);
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

/* ADR-053 — the vault's seven screens at every width. */
test("B-Systems admin: vault screens clean at every width", async ({ page }) => {
  test.setTimeout(180_000); // 7 paths × 5 widths, plus dev-mode first-hit compiles
  const errors: string[] = [];
  collectErrors(page, errors);
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);
  await sweep(page, errors, [
    "/vault",
    "/vault/forms",
    "/vault/sheets",
    "/vault/documents",
    "/vault/tasks",
    "/vault/employees",
    "/vault/archive",
  ]);
  expect(errors).toEqual([]);
});

test("mobile menu reaches EVERY admin section at 390px (incl. switcher + logout)", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/b-systems");
  await page.getByRole("button", { name: "Open menu" }).click();
  for (const label of [
    "Home",
    "Leads",
    "CRM",
    "Won Leads",
    "Partners & Agents",
    "Partners",
    "Agents",
    "Registrations",
    "Statements",
    "Users",
  ]) {
    /* the sheet's NAV rows specifically: ADR-067's module strip also carries a
       "CRM" segment down here, and the two are different controls — the nav row
       opens the board, the segment picks the module. Scoped by the nav row's
       own class so the assertion says which one it means. */
    await expect(
      page.getByRole("menu").locator(".nav-sheet-link").filter({ hasText: new RegExp(`^${label}$`) }),
    ).toBeVisible();
  }
  await expect(page.getByRole("menu").getByRole("button", { name: "Log out" })).toBeVisible();
  const sheetSwitcher = page.getByRole("menu").getByRole("group", { name: "Switch module" });
  await expect(sheetSwitcher).toBeVisible();
  /* ADR-054: Accounting and Data Vault left the nav — they are MODULE segments
     on the switcher now, reachable from the sheet too. */
  await expect(sheetSwitcher.getByRole("link", { name: "ACCOUNTING" })).toBeVisible();
  await expect(sheetSwitcher.getByRole("link", { name: "VAULT" })).toBeVisible();
  /* ADR-067: the COMPANY switch is reachable at this width WITHOUT the sheet —
     it lives on the page ground under the module bar, on screen at every width
     (module-bar.spec.ts pins it there at 390px with the sheet shut). So unlike
     Log out / the language toggle / the module strip, whose header twins ARE
     hidden below 820px, it must NOT be duplicated into the sheet: the first
     draft rendered it in both places and a phone with the burger open carried
     two live, identically-named "Switch company" groups (review, Run 080).
     Asserted as a COUNT, because "visible" would have passed on both. */
  await expect(page.getByRole("menu").getByRole("group", { name: "Switch company" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Switch company" })).toHaveCount(1);
  /* ADR-060: every switcher segment in the sheet is a real thumb target —
     BOTH axes (the language toggle's EN segment is the narrow one) */
  for (const box of await page
    .getByRole("menu")
    .locator(".switcher-seg")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect()))) {
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole("menu").getByRole("link", { name: "Statements", exact: true }).click();
  /* ADR-067 — every nav href in the merged shell spells the company out */
  await page.waitForURL(/\/b-systems\/statements\?company=bsystems$/);
});

/* ADR-054 — the founder's module directive: Accounting and Data Vault are
   switcher PEERS of the CRM. ADR-067 merged the two company CRMs into ONE
   segment, so one admin session walks the three MODULES through the switcher
   and then the two COMPANIES through the separate company switch — each
   control marking its own current segment. */
test("the module switcher moves between all three modules, and the company switch between the two companies", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);

  const switcher = () => page.locator(".user").getByRole("group", { name: "Switch module" });
  await expect(switcher().getByRole("link", { name: "CRM", exact: true })).toHaveAttribute(
    "aria-current",
    "true",
  );

  await switcher().getByRole("link", { name: "ACCOUNTING" }).click();
  await page.waitForURL(/\/accounting/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(switcher().getByRole("link", { name: "ACCOUNTING" })).toHaveAttribute(
    "aria-current",
    "true",
  );

  await switcher().getByRole("link", { name: "VAULT" }).click();
  await page.waitForURL(/\/vault/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(switcher().getByRole("link", { name: "VAULT" })).toHaveAttribute(
    "aria-current",
    "true",
  );

  await switcher().getByRole("link", { name: "CRM", exact: true }).click();
  await page.waitForURL(/\/b-systems$/);
  await expect(switcher().getByRole("link", { name: "CRM", exact: true })).toHaveAttribute(
    "aria-current",
    "true",
  );

  /* ADR-067 — and now the OTHER axis: the company, on its own labelled control
     inside the page, which states which company you are on in words. */
  const company = () => page.getByRole("group", { name: "Switch company" });
  await expect(page.locator(".company-switch-current")).toHaveText("B-Systems");
  await expect(company().getByRole("link", { name: "B-Systems" })).toHaveAttribute(
    "aria-current",
    "true",
  );

  await company().getByRole("link", { name: "ByteForce" }).click();
  await page.waitForURL(/\/b-systems\?company=byteforce$/);
  await expect(page.locator(".company-switch-current")).toHaveText("ByteForce");
  await expect(company().getByRole("link", { name: "ByteForce" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  /* the CHROME did not change — same brand scope, same wordmark, same header */
  await expect(page.locator("html")).toHaveAttribute("data-brand", "bsystems");
  await expect(page.locator(".app-header .wordmark")).toHaveText("B-Systems");

  await company().getByRole("link", { name: "B-Systems" }).click();
  await page.waitForURL(/\/b-systems\?company=bsystems$/);
  await expect(page.locator(".company-switch-current")).toHaveText("B-Systems");
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
  await page.waitForURL(/\/b-systems\/crm$/);
  await sweep(page, errors, [
    "/b-systems/crm",
    "/b-systems/won-leads",
    "/b-systems/payments",
    "/b-systems/profile",
  ]);
  expect(errors).toEqual([]);
});

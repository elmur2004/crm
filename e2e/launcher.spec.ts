import { expect, test, type Page } from "@playwright/test";
import { LAUNCHER_URL } from "./helpers/after-sign-in";

/* ADR-090 — the app launcher is the Home after sign-in. Founder: "it should be
   something like this [an app grid] with little icons opening each section:
   accounting, each CRM byteforce and bsystems, vault, to-do, reports +
   dashboards, partners and agents". Asked where it lives he chose "Home after
   sign-in", with a home icon in the header to come back to it. */

async function signIn(page: Page, id: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(id);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(LAUNCHER_URL);
}

const tiles = (page: Page) => page.locator("[data-app]");
const tileIds = async (page: Page) =>
  tiles(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-app")));

test("the founder lands on the launcher and sees every app, in his order", async ({ page }) => {
  await signIn(page, "admin@byteforce.com", "password123");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your apps" })).toBeVisible();
  expect(await tileIds(page)).toEqual([
    "crm-byteforce",
    "crm-bsystems",
    "accounting",
    "vault",
    "todo",
    "reports",
    "partners",
  ]);
});

test("a tile opens its app, and the header's All apps icon comes back", async ({ page }) => {
  await signIn(page, "admin@byteforce.com", "password123");
  await page.locator('[data-app="crm-bsystems"]').click();
  await page.waitForURL(/\/b-systems\/crm\?company=bsystems$/);
  await page.getByRole("link", { name: "All apps" }).click();
  await page.waitForURL(LAUNCHER_URL);

  await page.locator('[data-app="accounting"]').click();
  await page.waitForURL(/\/accounting/);
  await page.getByRole("link", { name: "All apps" }).click();
  await page.waitForURL(LAUNCHER_URL);

  await page.locator('[data-app="vault"]').click();
  await page.waitForURL(/\/vault/);
  await page.getByRole("link", { name: "All apps" }).click();
  await page.waitForURL(LAUNCHER_URL);

  await page.locator('[data-app="reports"]').click();
  await page.waitForURL(/\/apps\/reports/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

/* ONE WAY TO EACH PAGE — the launcher is the only way between apps, and the
   grid icon in each app header is the only way back to it. */
test("each app header has exactly ONE way back to the launcher, and no logo is a link", async ({ page }) => {
  await signIn(page, "admin@byteforce.com", "password123");
  /* the launcher's own lockup is a plain mark, not a link to the page you are on */
  await expect(page.locator(".lx-bar a")).toHaveCount(0);
  for (const path of [
    "/b-systems/crm?company=bsystems",
    "/b-systems/crm?company=byteforce",
    "/b-systems/partners-pipeline?company=bsystems",
    "/b-systems/todo?company=bsystems",
    "/b-systems?company=bsystems",
    "/b-systems/daily-report?company=bsystems",
    "/accounting",
    "/vault",
  ]) {
    await page.goto(path);
    await expect(page.locator("header a[href='/apps']"), path).toHaveCount(1);
    await expect(page.locator(".app-header .app-mark a, .app-header a.app-mark"), path).toHaveCount(0);
    await expect(page.locator(".app-header .app-mark"), path).toBeVisible();
  }
});

test("Reports & Dashboards lists the two CRM dashboards and the daily report — nothing from Accounting", async ({
  page,
}) => {
  await signIn(page, "admin@byteforce.com", "password123");
  await page.locator('[data-app="reports"]').click();
  await page.waitForURL(/\/apps\/reports$/);
  expect(await page.locator("[data-report]").evaluateAll((els) => els.map((e) => e.getAttribute("data-report")))).toEqual([
    "bs-dashboard",
    "bf-dashboard",
    "daily-report",
  ]);
  await expect(page.locator('main a[href^="/accounting"]')).toHaveCount(0);
  /* its one way back is the All apps link */
  await expect(page.getByRole("link", { name: "All apps" })).toHaveCount(1);
  await page.getByRole("link", { name: "All apps" }).click();
  await page.waitForURL(LAUNCHER_URL);
});

test("a sales rep sees only the apps the server lets him open", async ({ page }) => {
  await signIn(page, "omar@b-systems.example", "bsystems123");
  expect(await tileIds(page)).toEqual(["crm-bsystems", "todo", "reports"]);
  /* the doors the launcher withholds are really shut */
  await page.goto("/accounting");
  await expect(page).not.toHaveURL(/\/accounting/);
});

test("signed out, the launcher sends you to sign in", async ({ page }) => {
  await page.goto("/apps");
  await expect(page).toHaveURL(/\/login/);
});

for (const [name, width, height] of [
  ["phone", 375, 812],
  ["small phone", 320, 640],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
] as const) {
  test(`${name} (${width}×${height}): no sideways scroll, every tile a ≥44px target — English and Arabic`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await signIn(page, "admin@byteforce.com", "password123");
    for (const lang of ["en", "ar"] as const) {
      if (lang === "ar") {
        await page.getByRole("button", { name: "عربي" }).click();
        await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(tiles(page)).toHaveCount(7);
      for (const box of await tiles(page).evaluateAll((els) =>
        els.map((e) => e.getBoundingClientRect()).map((r) => ({ w: r.width, h: r.height })),
      )) {
        expect(box.w).toBeGreaterThanOrEqual(44);
        expect(box.h).toBeGreaterThanOrEqual(44);
      }
    }
    /* back to English for the rest of the suite's cookie-sharing specs */
    await page.getByRole("button", { name: "EN", exact: true }).click();
  });
}

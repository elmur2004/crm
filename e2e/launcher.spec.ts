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
    /* founder 2026-11-08 — Users is its own app, after Partners & Agents */
    "users",
  ]);
});

/* Founder (2026-11-08): "the apps whenever I open the home page should … have
   individual users tab not put the users inside B-System CRM, just separate it
   entirely into like an app or an icon in the home page." And again
   (2026-11-14, ADR-103): "Separate it, just put the users, every single type of
   users, put it in a different app … for the admin he of course can change all
   the users … If it's for a normal user, he can click on it to change his
   information too". */
test("Users is its own app, OUTSIDE every CRM: the admin's All users and My account", async ({ page }) => {
  await signIn(page, "admin@byteforce.com", "password123");
  await page.locator('[data-app="users"]').click();
  await page.waitForURL(/\/users$/);
  /* the launcher's bar and ground — no CRM header, no CRM menu */
  await expect(page.locator(".app-header")).toHaveCount(0);
  await expect(page.locator(".lx-bar")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible();
  const tabs = page.getByRole("navigation", { name: "Users views" });
  await expect(tabs.getByRole("link", { name: "All users" })).toHaveAttribute("aria-current", "page");
  /* every type of account is on it — both companies' people */
  for (const who of ["Elmur", "Sara Hassan", "Omar Farouk", "Karim Adel", "Hala Nabil"]) {
    await expect(page.getByRole("row", { name: new RegExp(who) }).first(), who).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Add user" })).toBeVisible();
  /* his own account is the second tab */
  await tabs.getByRole("link", { name: "My account" }).click();
  await page.waitForURL(/\/users\?tab=me$/);
  await expect(tabs.getByRole("link", { name: "My account" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();
  /* the pinned admin: his email and password are the healer's (bootstrap.ts) */
  await expect(page.getByLabel("Email")).toBeDisabled();
  await expect(page.getByText("The admin password is pinned", { exact: false })).toBeVisible();
  /* Users is in no CRM menu any more, and the one way back is All apps */
  await page.goto("/b-systems/crm?company=bsystems");
  await expect(page.locator(".app-header").getByRole("link", { name: "Users", exact: true })).toHaveCount(0);
  await page.goto("/users");
  await expect(page.getByRole("link", { name: "All apps" })).toHaveCount(1);
  await page.getByRole("link", { name: "All apps" }).click();
  await page.waitForURL(LAUNCHER_URL);
});

test("EVERY account has the Users tile — a teammate opens his own account, never the list", async ({ page }) => {
  await signIn(page, "sara@byteforce.example", "byteforce123");
  expect(await tileIds(page)).toEqual(["crm-byteforce", "todo", "reports", "users"]);
  await page.locator('[data-app="users"]').click();
  await page.waitForURL(/\/users$/);
  await expect(page.getByRole("heading", { level: 1, name: "My account" })).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Sara Hassan");
  await expect(page.getByLabel("Email")).toHaveValue("sara@byteforce.example");
  /* no list, no tabs, no admin action — whatever the address asks for */
  for (const path of ["/users", "/users?tab=all"]) {
    await page.goto(path);
    await expect(page.getByRole("link", { name: "All users" }), path).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add user" }), path).toHaveCount(0);
    await expect(page.getByRole("row", { name: /Omar Farouk/ }), path).toHaveCount(0);
  }
  /* the old addresses inside the CRM land here (ADR-103 — the proxy redirects) */
  await page.goto("/b-systems/users?company=bsystems");
  await expect(page).toHaveURL(/\/users$/);
  await page.goto("/b-systems/profile");
  await expect(page).toHaveURL(/\/users\?tab=me$/);
  await expect(page.getByRole("heading", { level: 1, name: "My account" })).toBeVisible();
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
  /* ADR-103 — Users is every account's: his own account */
  expect(await tileIds(page)).toEqual(["crm-bsystems", "todo", "reports", "users"]);
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
      await expect(tiles(page)).toHaveCount(8);
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

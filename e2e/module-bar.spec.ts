import { expect, test, type Page } from "@playwright/test";
import { afterSignIn, LAUNCHER_URL } from "./helpers/after-sign-in";

/* ============================================================================
   THE MODULE SWITCHER IS GONE — the launcher is the one way between apps.

   ADR-054/060 gave the shells a module switcher: a pill in the desktop header
   and, ≤820px, a full-width "module bar" under it (CRM · ACCOUNTING · VAULT).
   The founder has since asked for ONE way to each page ("there is multiple ways
   to get to each page there should be one way each for each page to get to"),
   and the launcher (/apps) is that one way between apps; the grid icon at the
   start of every header is the one way back to it.

   This file used to prove the bar. It now proves the bar and the pill are
   GONE — at every width, in all three shells, inside the burger sheet too — and
   that what the bar was for still works: moving between the apps in two taps
   through the launcher, with nothing ever pushing the page sideways. The
   phone sheet keeps exactly what it must: the language, the theme and Log out,
   tap-sized and legible on the light card.

   Real scrollbars on: headless Chromium hides them, and a hidden scrollbar is
   exactly how the old +44px overflow at 601px went unmeasured.
   ========================================================================== */

test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await afterSignIn(page, landing);
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Every trace the module switcher could leave: the phone bar, the header
    pill, and its accessible name anywhere on the page. */
async function expectNoModuleSwitch(page: Page, where: string) {
  await expect(page.locator(".switcher--bar"), `${where}: module bar`).toHaveCount(0);
  await expect(page.locator(".switcher-entity"), `${where}: header pill`).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Switch module" }), `${where}: module group`).toHaveCount(0);
  for (const name of ["ACCOUNTING", "VAULT"]) {
    await expect(page.getByRole("link", { name, exact: true }), `${where}: ${name} segment`).toHaveCount(0);
  }
}

const SHELL_PAGES = ["/b-systems/crm?company=bsystems", "/accounting", "/vault"];

test("no module bar and no header pill — on a phone, at the old overflow band, and on desktop", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems\/crm$/);
  for (const width of [390, 601, 820, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of SHELL_PAGES) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      await expectNoModuleSwitch(page, `${path} @${width}`);
      expect(await overflow(page), `${path} overflows at ${width}px`).toBeLessThanOrEqual(1);
    }
  }
});

test("the burger sheet carries the language, the theme and Log out — and no module segments", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems\/crm$/);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of SHELL_PAGES) {
    await page.goto(path);
    await page.getByRole("button", { name: "Open menu" }).click();
    const sheet = page.getByRole("menu");
    await expect(sheet).toBeVisible();
    await expectNoModuleSwitch(page, `${path} sheet`);
    /* 2 languages + 2 themes (Light / Dark since the founder removed
       "system"), on the same .switcher-seg idiom — and nothing else */
    const segs = sheet.locator(".switcher-seg");
    await expect(segs).toHaveCount(4);
    /* thumb-sized in BOTH axes — height alone left the ~35px-wide EN segment
       sub-thumb-size, so the width is pinned too */
    for (const box of await segs.evaluateAll((els) => els.map((el) => el.getBoundingClientRect()))) {
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
    /* legible: a NON-current segment's ink is the card's own token, never the
       indigo header's translucent white (the sheet lives INSIDE the header) */
    const seg = sheet.getByRole("button", { name: "عربي" });
    expect(await seg.evaluate((el) => getComputedStyle(el).color)).not.toContain("255, 255, 255");
    await expect(sheet.getByRole("button", { name: "Log out" })).toBeVisible();
    await page.getByRole("button", { name: "Close menu" }).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
  }
});

test("moving between apps is the launcher: two taps on a phone, all three shells, never a sideways scroll", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems\/crm$/);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [tile, url] of [
    ["accounting", /\/accounting/],
    ["vault", /\/vault/],
    ["crm-bsystems", /\/b-systems\/crm\?company=bsystems$/],
    ["crm-byteforce", /\/b-systems\/crm\?company=byteforce$/],
  ] as const) {
    await page.getByRole("link", { name: "All apps" }).click();
    await page.waitForURL(LAUNCHER_URL);
    await page.locator(`[data-app="${tile}"]`).click();
    await page.waitForURL(url);
    /* the All apps icon is a real thumb target, first in the header */
    const box = (await page.getByRole("link", { name: "All apps" }).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(36);
    expect(await overflow(page), tile).toBeLessThanOrEqual(1);
  }
});

test("Arabic: no bar, the header still fits, and the way between apps mirrors with it", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems\/crm$/);
  await page.getByRole("button", { name: "عربي" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  for (const width of [320, 390, 601]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of SHELL_PAGES) {
      await page.goto(path);
      await expectNoModuleSwitch(page, `${path} AR @${width}`);
      expect(await overflow(page), `${path} AR @${width}`).toBeLessThanOrEqual(1);
    }
  }
  /* the grid icon sits at the inline START — the right edge in Arabic */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/b-systems/crm?company=bsystems");
  const home = (await page.getByRole("link", { name: "كل التطبيقات" }).boundingBox())!;
  expect(home.x).toBeGreaterThan(390 / 2);
});

test("hard-narrow screens: the CRM header's app name gives way with an ellipsis — the page never scrolls", async ({
  page,
}) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems\/crm$/);
  /* the longest names the shell can show are Reports & Dashboards' and
     Partners & Agents'; 320px is the project's hard floor, and below it (240)
     the dashboard — the page that has always been held to it — still fits */
  for (const [width, paths] of [
    [320, ["/b-systems?company=bsystems", "/b-systems/partners-pipeline?company=bsystems"]],
    [240, ["/b-systems?company=bsystems"]],
  ] as const) {
    await page.setViewportSize({ width, height: 700 });
    for (const path of paths) {
      await page.goto(path);
      expect(await overflow(page), `${path} @${width}`).toBeLessThanOrEqual(1);
      const name = page.locator(".app-header .app-name");
      await expect(name).toBeVisible();
      /* the STRUCTURE that makes a cut visible rather than silent */
      expect(await name.evaluate((el) => getComputedStyle(el).textOverflow)).toBe("ellipsis");
      expect(await name.evaluate((el) => getComputedStyle(el).overflow)).toBe("hidden");
      /* and nothing in the header runs past the screen */
      for (const box of await page
        .locator(".app-header > *")
        .evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0))) {
        expect(box.right, `${path} @${width}`).toBeLessThanOrEqual(width + 1);
        expect(box.left, `${path} @${width}`).toBeGreaterThanOrEqual(-1);
      }
    }
  }
});

test("a single-company user gets no switch of any kind — zero new furniture", async ({ page }) => {
  await login(page, "sara@byteforce.example", "byteforce123", /\/b-systems\?company=byteforce$/);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    "/b-systems?company=byteforce",
    "/b-systems/crm?company=byteforce",
    "/b-systems/todo?company=byteforce",
    "/b-systems/leads?company=byteforce",
    "/b-systems/clients?company=byteforce",
  ]) {
    await page.goto(path);
    await expectNoModuleSwitch(page, path);
    await expect(page.getByRole("group", { name: "Switch company" })).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Company" })).toHaveCount(0);
  }
  await page.goto("/b-systems/crm?company=byteforce");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("group", { name: "Switch company" })).toHaveCount(0);
  await expectNoModuleSwitch(page, "sheet");
  expect(await overflow(page)).toBeLessThanOrEqual(1);
});

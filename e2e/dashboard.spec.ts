import { expect, test, type Page } from "@playwright/test";
import { afterSignIn } from "./helpers/after-sign-in";

/* ============================================================================
   The Home (dashboard spec §9.5) — what a person does with it.

   Figures are read from `data-value` (the server value), never from animated
   text. This file runs under reduced motion (below); the motion itself is
   e2e/motion.spec.ts.
   ========================================================================== */

/* Reduced motion for THIS file (dashboard spec §5.3, research R0): nothing
   here may race a draw-in. It is scoped to the Home's specs rather than set
   suite-wide, because the suite-wide setting changed what zoom.spec's A5
   measures on the board (a 15px shift at 50% zoom inside the harness, not
   reproducible by hand) — a follow-up, not something to hide in this round. */
test.use({ contextOptions: { reducedMotion: "reduce" } });

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await afterSignIn(page, landing);
}

const metric = (page: Page, key: string) =>
  page
    .locator(`[data-metric="${key}"]`)
    .first()
    .getAttribute("data-value")
    .then((v) => Number(v));

const cairoDate = (dayOffset = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(
    new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000),
  );

async function overflowAt(page: Page, width: number) {
  await page.setViewportSize({ width, height: 800 });
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test("the Home renders both companies' dashboards, each with only its own furniture", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Welcome back, /);
  for (const key of ["won_period", "new_leads", "win_rate", "pipeline_value", "total_leads", "funnel"]) {
    await expect(page.locator(`[data-metric="${key}"]`), key).toHaveCount(1);
  }
  /* B-Systems: the admin's own cards */
  await expect(page.locator('[data-metric="needs_you"]')).toHaveCount(1);
  await expect(page.locator('[data-metric="milestones_outstanding"]')).toHaveCount(1);
  await expect(page.getByText("Agent & partner pipeline")).toBeVisible();

  /* ByteForce: never agents, partners, milestones or Needs you */
  await page.goto("/b-systems?company=byteforce");
  await expect(page.getByText("BYTEFORCE ·", { exact: false })).toBeVisible();
  await expect(page.locator('[data-metric="needs_you"]')).toHaveCount(0);
  await expect(page.locator('[data-metric="milestones_outstanding"]')).toHaveCount(0);
  await expect(page.locator('[data-metric="agents"]')).toHaveCount(0);
  await expect(page.getByText("Agent & partner pipeline")).toHaveCount(0);
  await expect(page.locator('[data-metric="to_be_collected"]')).toHaveCount(1);

  /* the invariant, on the real page: Σ stage bars = Total leads */
  for (const company of ["bsystems", "byteforce"]) {
    await page.goto(`/b-systems?company=${company}`);
    const bars = await page
      .locator('[data-metric^="stage:"]')
      .evaluateAll((els) => els.reduce((a, el) => a + Number(el.getAttribute("data-value")), 0));
    expect(bars, company).toBe(await metric(page, "total_leads"));
  }
});

test("range switching: the URL, the eyebrows and the counts all follow the period", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  const newLeads = page.locator('[data-metric="new_leads"]');
  const eyebrowMtd = await newLeads.locator(".db-eyebrow").textContent();
  /* every seeded lead was created at seed time, i.e. this month */
  expect(await metric(page, "new_leads")).toBeGreaterThan(0);
  await expect(page.locator('[data-metric="won_period"] .db-kpi-label')).toHaveText("Won this month");

  await page.getByRole("button", { name: /Period/ }).click();
  const menu = page.locator("#db-range-menu");
  await expect(menu).toBeVisible();
  /* the selected preset is marked, in words and for assistive tech */
  await expect(menu.getByRole("link", { name: /This month/ })).toHaveAttribute("aria-current", "true");
  const box = await menu.getByRole("link", { name: /Last month/ }).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await menu.getByRole("link", { name: /Last month/ }).click();

  await page.waitForURL(/range=last_month/);
  await expect(page.locator(".db-range-value")).toHaveText("Last month");
  await expect(page.locator('[data-metric="won_period"] .db-kpi-label')).toHaveText("Won last month");
  await expect(newLeads.locator(".db-eyebrow")).not.toHaveText(eyebrowMtd!);
  /* nothing in this database was created last month */
  expect(await metric(page, "new_leads")).toBe(0);
  /* the popover closed itself when the new period rendered */
  await expect(page.locator("#db-range-menu")).toBeHidden();

  /* a NOW card does not move with the range */
  const pipelineLast = await metric(page, "pipeline_value");
  await page.goto("/b-systems?range=7d");
  await expect(page.locator(".db-range-value")).toHaveText("Last 7 days");
  expect(await metric(page, "pipeline_value")).toBe(pipelineLast);
  expect(await metric(page, "new_leads")).toBeGreaterThan(0);

  /* a stale or junk range still renders — as This month */
  await page.goto("/b-systems?range=forever");
  await expect(page.locator(".db-range-value")).toHaveText("This month");
});

test("a chart tooltip is reachable by keyboard, and 'View as table' opens the exact values", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  const card = page.locator("#db-stages");
  /* start from the card's own link, then TAB to the first bar */
  await card.getByRole("link", { name: "Open the board" }).focus();
  await page.keyboard.press("Tab");
  const firstBar = card.locator(".db-stagebar-hit").first();
  await expect(firstBar).toBeFocused();
  const tipId = await firstBar.getAttribute("aria-describedby");
  await expect(page.locator(`[id="${tipId}"]`)).toBeVisible();
  await expect(page.locator(`[id="${tipId}"]`)).toContainText("% of all leads");
  /* and away again: the tooltip goes */
  await page.keyboard.press("Tab");
  await expect(page.locator(`[id="${tipId}"]`)).toBeHidden();

  /* the trend's month columns are keyboard stops too */
  const month = page.locator("#db-trend .db-trend-hit").last();
  await month.focus();
  await expect(page.locator(`[id="${await month.getAttribute("aria-describedby")}"]`)).toBeVisible();

  /* View as table — zero JavaScript, the same numbers as the bars */
  const table = card.locator("details.db-table").first();
  await table.locator("summary").click();
  await expect(table.locator("table")).toBeVisible();
  const won = await metric(page, "stage:won");
  await expect(table.getByRole("row", { name: /^Won/ }).getByRole("cell").first()).toHaveText(String(won));
  const summaryBox = await table.locator("summary").boundingBox();
  expect(summaryBox!.height).toBeGreaterThanOrEqual(44);
});

test("on a phone a TAP opens a tooltip, and nothing scrolls sideways at 320px in either language", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ baseURL, hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  const bar = page.locator("#db-stages .db-stagebar-hit").first();
  await bar.scrollIntoViewIfNeeded();
  await bar.tap();
  await expect(page.locator(`[id="${await bar.getAttribute("aria-describedby")}"]`)).toBeVisible();

  for (const company of ["bsystems", "byteforce"]) {
    await page.goto(`/b-systems?company=${company}`);
    expect(await overflowAt(page, 320), `${company} EN @320`).toBeLessThanOrEqual(0);
  }
  /* Arabic — on a phone the language toggle lives in the menu sheet, so set
     the same cookie it writes */
  await context.addCookies([{ name: "locale", value: "ar", url: baseURL! }]);
  for (const company of ["bsystems", "byteforce"]) {
    await page.goto(`/b-systems?company=${company}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    expect(await overflowAt(page, 320), `${company} AR @320`).toBeLessThanOrEqual(0);
  }
  /* touch targets: the range button and the task/row links are thumb-sized */
  const btn = await page.locator(".db-range-btn").boundingBox();
  expect(btn!.height).toBeGreaterThanOrEqual(44);
  await context.close();
});

test("Arabic: the Home is right-to-left, and its figures are Latin digits isolated in <bdi>", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  await page.getByRole("button", { name: "عربي" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.goto("/b-systems");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("مرحبًا بعودتك");
  const figures = await page.locator(".db-kpi-value bdi, .db-stat dd bdi").allTextContents();
  expect(figures.length).toBeGreaterThan(5);
  for (const text of figures) {
    expect(text, text).not.toMatch(/[٠-٩۰-۹]/); // no Arabic-Indic digits
    expect(text, text).toMatch(/[0-9]|—/);
  }
  /* the meter fills from the inline START — the right, in Arabic */
  const d = await page.locator('[data-metric="win_rate"] .db-meter-track').getAttribute("d");
  expect(d).toMatch(/^M\s*\d+(\.\d+)?\s/);
  expect(Number(/^M\s*([\d.]+)/.exec(d!)![1])).toBeGreaterThan(0);
});

test("dark theme: the Home paints no pure-white surface", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "theme", value: "dark", url: baseURL! }]);
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  for (const company of ["bsystems", "byteforce"]) {
    await page.goto(`/b-systems?company=${company}`);
    const white = await page.locator(".db").evaluate((root) =>
      [root, ...root.querySelectorAll("*")]
        .filter((el) => getComputedStyle(el).backgroundColor === "rgb(255, 255, 255)")
        .map((el) => el.className.toString() || el.tagName),
    );
    expect(white, company).toEqual([]);
  }
});

test("ticking a task on the Home marks it done on the To-Do page", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  const created = await page.request.post("/api/b-systems/leads", {
    data: { name: "Home Tick Lead", number: "0109990777", type: "cold_call", companyName: "Home Tick Co" },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const moved = await page.request.post(`/api/b-systems/leads/${id}/event`, {
    data: {
      event: { type: "drag", to: "following_up" },
      group: { group: "follow_up", data: { date: cairoDate(), time: "10:00", method: "call" } },
    },
  });
  expect(moved.ok()).toBeTruthy();

  await page.goto("/b-systems");
  const tasks = page.locator("#db-tasks");
  const doneBefore = Number(await tasks.getAttribute("data-done"));
  const box = tasks.getByRole("checkbox", { name: "Mark done: Home Tick Lead" });
  await expect(box).toBeVisible();
  await box.click();
  /* the refresh moves it off the Home's open list and the done count follows */
  await expect(tasks.getByRole("checkbox", { name: "Mark done: Home Tick Lead" })).toHaveCount(0);
  await expect(tasks).toHaveAttribute("data-done", String(doneBefore + 1));

  await page.goto("/b-systems/todo");
  const restore = page.getByRole("checkbox", { name: "Restore to Today: Home Tick Lead" });
  await expect(restore).toBeVisible();
  await expect(restore).toBeChecked();
});

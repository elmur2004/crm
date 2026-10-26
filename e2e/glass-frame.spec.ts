import { expect, test, type Page } from "@playwright/test";
import { afterSignIn } from "./helpers/after-sign-in";

/* ============================================================================
   THE GLASS FRAME + MOTION FOUNDATION, on the built app.

   Founder: "the log in page is very nicely animated and designed the rest of
   the system is still not"; asked how far the glass should go: "Glass frame,
   solid data". And, during the same pass: "remove the system theme option".

   The arithmetic (contrast on glass, the motion fence, the token law) is
   src/themes/glass-motion.test.ts. This file proves the behaviour a stylesheet
   cannot prove on paper: the header really sticks and really frosts, the phone
   sheet still covers the screen (a frosted header must never become the
   containing block of the fixed sheet inside it), the ground sits behind the
   content and never prints, the page entrance settles, nothing moves under
   reduced motion, a route streams its skeleton first — and the theme toggle
   offers exactly Light and Dark.
   ========================================================================== */

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await afterSignIn(page, /\/b-systems$/);
}

test("the theme toggle offers exactly Light and Dark — and a stored \"system\" cookie renders light", async ({
  page,
  context,
  baseURL,
}) => {
  /* the retired third value, as a cookie set before the founder removed it */
  await context.addCookies([{ name: "theme", value: "system", url: baseURL! }]);
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  /* no dark browser chrome for a light page */
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(0);
  const theme = page.getByRole("group", { name: "Theme" });
  await expect(theme.getByRole("button")).toHaveCount(2);
  await expect(theme.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
  await expect(theme.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "false");
  await expect(theme.getByRole("button", { name: "System" })).toHaveCount(0);

  /* and in the app header, the same two */
  await login(page);
  const header = page.locator(".app-header .user").getByRole("group", { name: "Theme" });
  await expect(header.getByRole("button")).toHaveCount(2);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  /* choosing Dark is instant and sticks; choosing Light comes back */
  await header.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.locator(".app-header .user").getByRole("group", { name: "Theme" }).getByRole("button", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("the header is sticky glass, and the phone sheet still covers the screen beneath it", async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/b-systems/leads?company=bsystems");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const frost = await page.locator(".app-header").evaluate((el) => {
    const before = getComputedStyle(el, "::before");
    return {
      position: getComputedStyle(el).position,
      ownFilter: getComputedStyle(el).backdropFilter,
      frost: before.backdropFilter || (before as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter || "",
    };
  });
  expect(frost.position).toBe("sticky");
  /* the frost is on the ::before — never the header itself (it contains the
     fixed phone sheet) */
  expect(frost.ownFilter === "none" || frost.ownFilter === "").toBe(true);
  expect(frost.frost).toContain("blur");

  /* scrolled, the header stays at the top of the viewport (the page is made
     long enough to scroll whatever the seed holds) */
  await page.evaluate(() => {
    document.querySelector<HTMLElement>("main.page")!.style.paddingBottom = "2400px";
    window.scrollTo(0, 900);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  const top = await page.locator(".app-header").evaluate((el) => el.getBoundingClientRect().top);
  expect(Math.abs(top)).toBeLessThanOrEqual(1);

  /* the phone: the sheet and its backdrop are still sized by the VIEWPORT */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  const backdrop = await page.locator(".nav-sheet-backdrop").evaluate((el) => el.getBoundingClientRect().height);
  expect(backdrop).toBeGreaterThan(844 - 54 - 2);
  /* and it closes (an exit of ~140 ms, then it is gone) */
  await page.getByRole("button", { name: "Close menu" }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.locator(".nav-sheet")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("the ground glows behind the content, is aria-hidden, and never prints", async ({ page }) => {
  await login(page);
  await page.goto("/b-systems/crm?company=bsystems");
  const ground = page.locator(".app-ground");
  await expect(ground).toHaveCount(1);
  await expect(ground).toHaveAttribute("aria-hidden", "true");
  const cs = await ground.evaluate((el) => {
    const s = getComputedStyle(el);
    return { position: s.position, z: s.zIndex, events: s.pointerEvents };
  });
  expect(cs).toEqual({ position: "fixed", z: "-1", events: "none" });
  /* the modules mount theirs INSIDE the brand scope, so it glows in the
     company's own colours */
  await page.goto("/accounting");
  await expect(page.locator(".app-shell > .app-ground")).toHaveCount(1);
  await page.emulateMedia({ media: "print" });
  expect(await page.locator(".app-ground").evaluate((el) => getComputedStyle(el).display)).toBe("none");
  /* and a printed page carries no frost anywhere */
  const frosted = await page.evaluate(() =>
    [...document.querySelectorAll("*")].filter((el) => {
      const s = getComputedStyle(el);
      return s.backdropFilter && s.backdropFilter !== "none";
    }).length,
  );
  expect(frosted).toBe(0);
  await page.emulateMedia({ media: "screen" });
});

test.describe("with motion on", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  test("the page rises in on the house motion, then everything a person clicks is still", async ({ page }) => {
    await login(page);
    await page.goto("/b-systems/crm?company=bsystems");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    /* the page sits in RoutePending's display:contents host, so the
       entrance is on the host's children. (There used to be two blocks here
       for the founder: the company switch sat above the page. One way to each
       page took the switch away, so the board is the host's one block.) */
    const names = await page
      .locator(".page > :not(.route-host), .page > .route-host > *")
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).animationName));
    expect(names.length).toBeGreaterThanOrEqual(1);
    expect(names.every((n) => n === "mo-rise")).toBe(true);
    /* settled: no finite animation still running, only the decorative loops */
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              document
                .getAnimations()
                .filter((a) => a.playState === "running")
                .filter((a) => (a.effect?.getTiming().iterations ?? 1) !== Infinity).length,
          ),
        { timeout: 3000 },
      )
      .toBe(0);
  });

  test("the language and theme switches slide one pill between their segments", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/b-systems?company=bsystems");
    const theme = page.locator(".app-header .user .theme-toggle");
    await expect(theme).toHaveAttribute("data-indicator", "");
    const x = () => theme.locator(".switch-ind").evaluate((el) => getComputedStyle(el).getPropertyValue("--ind-x"));
    const before = await x();
    await theme.getByRole("button", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect.poll(x).not.toBe(before);
    await theme.getByRole("button", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect.poll(x).toBe(before);
  });
});

test("under reduced motion the frame does not move at all", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, reducedMotion: "reduce" });
  const page = await context.newPage();
  await login(page);
  await page.goto("/b-systems/crm?company=bsystems");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const moving = await page.evaluate(() =>
    document
      .getAnimations()
      .map((a) => (a as CSSAnimation).animationName ?? "")
      .filter((n) => n.startsWith("mo-")),
  );
  expect(moving).toEqual([]);
  await context.close();
});

test("a click to another screen shows its skeleton at once — and the document itself is always the whole page", async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  /* the server never streams a skeleton: the first byte is the page (no-JS
     safe — see RoutePending) */
  const html = await (await page.request.get("/b-systems/crm?company=bsystems")).text();
  expect(html).not.toContain("data-skeleton");
  expect(html).toContain('class="board');

  /* hold the navigation's data so the in-between state can be seen — from a
     CRM page, whose menu holds the board (the dashboards have no menu now) */
  await page.goto("/b-systems/leads?company=bsystems");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  let release: () => void = () => undefined;
  const held = new Promise<void>((r) => (release = r));
  await page.route(/\/b-systems\/crm\?/, async (route) => {
    const h = route.request().headers();
    if (h["rsc"] && !h["next-router-prefetch"]) await held;
    await route.continue().catch(() => undefined);
  });
  await page.locator(".app-nav .nav-item").filter({ hasText: /^CRM$/ }).click();
  const skeleton = page.locator('[data-skeleton="board"]');
  await expect(skeleton).toBeVisible();
  /* it is shapes only — no heading, no board, one spoken line */
  await expect(skeleton.getByRole("heading")).toHaveCount(0);
  await expect(skeleton.locator(".board")).toHaveCount(0);
  await expect(skeleton.getByRole("status")).toHaveText("Loading the page…");
  release();
  await page.waitForURL(/\/b-systems\/crm\?company=bsystems/);
  await expect(page.locator(".board")).toBeVisible();
  await expect(page.locator("[data-skeleton]")).toHaveCount(0);
  await page.unroute(/\/b-systems\/crm\?/);

  /* a same-path change (the To-Do's company tab) keeps the page: no skeleton */
  await page.goto("/b-systems/todo?company=bsystems");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("group", { name: "Company" }).getByRole("link", { name: "ByteForce" }).click();
  await page.waitForURL(/\/b-systems\/todo\?company=byteforce$/);
  await expect(page.locator("[data-skeleton]")).toHaveCount(0);
});

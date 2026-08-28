import { expect, test, type Page } from "@playwright/test";

/* ============================================================================
   ADR-060 — MOBILE MODULE SWITCHING (the founder's 4.1).

   ≤820px the rigid header switcher leaves the header and a full-width module
   bar renders directly UNDER it: equal 1fr cells that cannot overflow any
   viewport, ≥44px tall, one tap, current module inverted. Desktop keeps the
   header pill untouched. Single-entity users get no bar at all. The burger
   sheet keeps its own copy (every control reachable from the sheet), now
   tap-sized and re-grounded on the light card.

   Real scrollbars on: headless Chromium hides them, and a hidden scrollbar
   is exactly how the old +44px overflow at 601px went unmeasured.
   ========================================================================== */

test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const bar = (page: Page) => page.locator(".switcher--bar");

test("the module bar switches all three modules in ONE tap at phone width", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/b-systems");

  /* the bar sits under the header; the header itself carries no entity strip */
  await expect(bar(page)).toBeVisible();
  await expect(page.locator(".app-header .user .switcher-entity")).toBeHidden();
  const header = (await page.locator(".app-header").boundingBox())!;
  const barBox = (await bar(page).boundingBox())!;
  expect(barBox.y).toBeGreaterThanOrEqual(header.y + header.height - 1);

  /* ADR-067 — THREE segments now, not four: the two CRMs merged into one app,
     so the bar asks "which module" and the company switch asks "which company".
     Every cell is a thumb target, all inside the viewport — and each one is
     WIDER than it was, which is the direction ADR-060's overflow work wanted. */
  const segs = bar(page).locator(".switcher-seg");
  await expect(segs).toHaveCount(3);
  for (const box of await segs.evaluateAll((els) => els.map((el) => el.getBoundingClientRect()))) {
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.right).toBeLessThanOrEqual(391);
    expect(box.left).toBeGreaterThanOrEqual(-1);
  }
  expect(await overflow(page)).toBeLessThanOrEqual(1);

  /* the current module is unmistakable, and ONE tap moves between all three */
  await expect(bar(page).getByRole("link", { name: "CRM", exact: true })).toHaveAttribute(
    "aria-current",
    "true",
  );

  await bar(page).getByRole("link", { name: "ACCOUNTING" }).click();
  await page.waitForURL(/\/accounting/);
  await expect(bar(page).getByRole("link", { name: "ACCOUNTING" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  expect(await overflow(page)).toBeLessThanOrEqual(1);

  await bar(page).getByRole("link", { name: "VAULT" }).click();
  await page.waitForURL(/\/vault/);
  await expect(bar(page).getByRole("link", { name: "VAULT" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  expect(await overflow(page)).toBeLessThanOrEqual(1);

  await bar(page).getByRole("link", { name: "CRM", exact: true }).click();
  await page.waitForURL(/\/b-systems$/);
  await expect(bar(page).getByRole("link", { name: "CRM", exact: true })).toHaveAttribute(
    "aria-current",
    "true",
  );
  expect(await overflow(page)).toBeLessThanOrEqual(1);

  /* ADR-067 — and the COMPANY switch is a DIFFERENT control, on the page
     ground below the bar, carrying its own words. Two strips, two questions. */
  const company = page.getByRole("group", { name: "Switch company" });
  await expect(company).toBeVisible();
  await expect(company.getByRole("link", { name: "ByteForce" })).toBeVisible();
  const companyBox = (await company.boundingBox())!;
  const barAfter = (await bar(page).boundingBox())!;
  expect(companyBox.y).toBeGreaterThan(barAfter.y + barAfter.height - 1);
  expect(await overflow(page)).toBeLessThanOrEqual(1);
});

test("the 601–645px overflow band is closed, and desktop is untouched", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  /* 601px is the exact width the four-segment header strip overflowed by a
     measured +44px (EN); 820 is the bar's own upper edge */
  for (const width of [601, 820]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/b-systems");
    await expect(bar(page)).toBeVisible();
    await expect(page.locator(".app-header .user .switcher-entity")).toBeHidden();
    expect(await overflow(page), `overflow at ${width}px`).toBeLessThanOrEqual(1);
  }
  /* desktop: header pill exactly as before, no bar */
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.goto("/b-systems");
  await expect(bar(page)).toBeHidden();
  await expect(page.locator(".app-header .user .switcher-entity")).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(1);
});

test("Arabic: the bar mirrors, keeps its localized labels, and still fits", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  await page.getByRole("button", { name: "عربي" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/b-systems");

  await expect(bar(page)).toBeVisible();
  await expect(bar(page).getByRole("link", { name: "الحسابات" })).toBeVisible();
  await expect(bar(page).getByRole("link", { name: "الخزنة" })).toBeVisible();
  /* RTL order: the first DOM segment (CRM) renders at the inline START,
     which is the RIGHT edge. Three segments since ADR-067, so the last index
     moved with the count — the assertion is about ORDER, not about four. */
  const xs = await bar(page)
    .locator(".switcher-seg")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().x));
  expect(xs[0]!).toBeGreaterThan(xs[xs.length - 1]!);
  expect(await overflow(page)).toBeLessThanOrEqual(1);

  await bar(page).getByRole("link", { name: "الحسابات" }).click();
  await page.waitForURL(/\/accounting/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(bar(page).getByRole("link", { name: "الحسابات" })).toHaveAttribute(
    "aria-current",
    "true",
  );
});

test("hard-narrow screens cut long labels VISIBLY — ellipsis, page still never scrolls", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);

  /* 320px is the project's hard floor. ADR-067 took the bar from four cells to
     three, so each cell went from ~67px to ~100px and ACCOUNTING — the longest
     label left — now FITS here. That is the merge paying for itself, and the
     assertion follows the fact rather than the other way round. */
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/b-systems");
  await expect(bar(page)).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(1);
  const label = bar(page).getByRole("link", { name: "ACCOUNTING" }).locator(".switcher-label");
  expect(await label.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);

  /* the STRUCTURE that makes a cut visible must still be in place, because the
     day a label grows or a fourth module arrives it is the only thing standing
     between the founder and silently truncated text. It must live on the label
     SPAN — a block-level grid item — since text-overflow never applies to the
     grid seg itself; asserting it here pins that structure. */
  expect(await label.evaluate((el) => getComputedStyle(el).textOverflow)).toBe("ellipsis");
  expect(await label.evaluate((el) => getComputedStyle(el).overflow)).toBe("hidden");

  /* and it really does clip rather than push: below the floor, where the label
     genuinely outgrows its cell, the cut appears and the page still never
     scrolls sideways */
  await page.setViewportSize({ width: 240, height: 700 });
  await page.goto("/b-systems");
  expect(await label.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  expect(await overflow(page)).toBeLessThanOrEqual(1);
  for (const box of await bar(page)
    .locator(".switcher-seg")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect()))) {
    expect(box.right).toBeLessThanOrEqual(241);
    expect(box.left).toBeGreaterThanOrEqual(-1);
  }
});

test("a single-entity user gets NO bar and NO company switch — zero new furniture", async ({
  page,
}) => {
  await login(page, "sara@byteforce.example", "byteforce123", /\/b-systems\?company=byteforce$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/b-systems?company=byteforce");
  await expect(page.locator(".switcher--bar")).toHaveCount(0);
  /* ADR-067 decision 7 — a ByteForce-locked teammate is shown NO switch at
     all, on any screen and inside the burger sheet. A hidden-but-present
     switch would be a failure, so this is asserted negatively. */
  for (const path of [
    "/b-systems?company=byteforce",
    "/b-systems/crm?company=byteforce",
    "/b-systems/todo?company=byteforce",
    "/b-systems/leads?company=byteforce",
    "/b-systems/clients?company=byteforce",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("group", { name: "Switch company" })).toHaveCount(0);
  }
  await page.goto("/b-systems?company=byteforce");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("group", { name: "Switch company" })).toHaveCount(0);
  expect(await overflow(page)).toBeLessThanOrEqual(1);
});

test("the sheet's switchers are tap-sized and legible on the light card", async ({ page }) => {
  await login(page, "admin@byteforce.com", "password123", /\/b-systems$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/b-systems");
  await page.getByRole("button", { name: "Open menu" }).click();

  const sheetSegs = page.getByRole("menu").locator(".switcher-seg");
  /* ADR-067: 3 modules + EN/عربي. The COMPANY segments are deliberately NOT
     here (review, Run 080): the sheet carries the controls whose HEADER twin is
     hidden below 820px, and the company switch has no header twin — it lives in
     the page body and is on screen at every width (pinned at 390px with the
     sheet shut, in the test above). Duplicating it into the sheet put two live,
     identically-named "Switch company" groups on one phone screen. */
  await expect(sheetSegs).toHaveCount(5);
  /* thumb-sized in BOTH axes — height alone left the ~35px-wide EN segment
     sub-thumb-size, so the width is pinned too */
  for (const box of await sheetSegs.evaluateAll((els) => els.map((el) => el.getBoundingClientRect()))) {
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
  /* legible: a NON-current segment's ink is the card's own token, never the
     indigo header's translucent white (the bleed the sheet used to inherit —
     the sheet lives INSIDE the header element) */
  const seg = page.getByRole("menu").getByRole("link", { name: "ACCOUNTING" });
  const color = await seg.evaluate((el) => getComputedStyle(el).color);
  expect(color).not.toContain("255, 255, 255");
});

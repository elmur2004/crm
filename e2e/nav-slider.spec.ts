import { expect, test } from "@playwright/test";

/* Founder (screenshot: "Registrations" clipped to "Regi"): the header nav must
   be "a slider, so when I am pressing on the arrow ... it slides". When the
   desktop strip overflows, chevron buttons appear over its ends, the clipped
   edge fades, and a press pages the strip — revealing the hidden sections. */

test("the admin nav strip slides: the end chevron reveals the clipped sections", async ({
  page,
}) => {
  /* > 820px (the sheet takes over below that), narrow enough that the
     B-Systems admin's eleven sections cannot all fit. Not too narrow either:
     the header's fixed logo + user cluster eat ~860px, and the strip needs a
     workable share left over for the walk below. */
  await page.setViewportSize({ width: 1180, height: 800 });
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);

  const strip = page.locator(".nav-strip");
  const users = strip.getByRole("link", { name: "Users", exact: true });
  await expect(users).not.toBeInViewport();

  /* only the END chevron shows while the strip sits at its start */
  const forward = page.getByRole("button", { name: "Scroll navigation forward" });
  const back = page.getByRole("button", { name: "Scroll navigation backward" });
  await expect(forward).toBeVisible();
  await expect(back).toHaveCount(0);

  /* one press slides the strip (a page is 70% of the visible strip) and the
     way back appears */
  await forward.click();
  await expect
    .poll(async () =>
      Math.abs(await strip.locator(".app-nav").evaluate((el) => el.scrollLeft)),
    )
    .toBeGreaterThan(100);
  await expect(back).toBeVisible();

  /* repeated presses walk the whole strip: the clipped tail (Users is the
     last section) comes into view, and once there is nothing further the
     forward arrow retires — chevrons only exist where they can act */
  for (let i = 0; i < 8 && (await forward.count()) > 0; i++) {
    await forward.click();
    await page.waitForTimeout(400); // smooth-scroll settles, measure() re-runs
  }
  await expect(users).toBeInViewport();
  await expect(forward).toHaveCount(0);
  await expect(back).toBeVisible();

  /* the slider never widens the page (qa-sweep's rule, asserted here at the
     width that triggers it) */
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

/* A9 (zoom round) — the founder's ORIGINAL screenshot was "Registrations" cut
   to "Regi" with no way to know there was more. The slider fixed that, but its
   overflow test read `scrollWidth - clientWidth`: both are integer-rounded, so
   at a fractional browser zoom a label clipped by up to 1px measured as "no
   overflow" and the chevron never appeared — the same silent truncation, back
   at 90% and 110%. The affordance is now measured off the items' fractional
   rects. This walks the band and asserts the rule directly: if the strip really
   clips a label, there is a way to reach it. */
test("A9: a chevron exists whenever the nav strip really clips a section", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);

  /* the strip's own overflow, measured sub-pixel — never via scrollWidth */
  const clips = () =>
    page.locator(".nav-strip .app-nav").evaluate((el) => {
      const box = el.getBoundingClientRect();
      const kids = [...el.children].map((c) => c.getBoundingClientRect());
      if (kids.length === 0) return 0;
      const hiddenStart = box.left - Math.min(...kids.map((r) => r.left));
      const hiddenEnd = Math.max(...kids.map((r) => r.right)) - box.right;
      return Math.max(hiddenStart, hiddenEnd);
    });
  const chevrons = () => page.getByRole("button", { name: /Scroll navigation/ }).count();

  /* (a) layout zoom: 85% → 125% of a 1180px window, all still above the 820px
     breakpoint where the desktop strip gives way to the burger */
  for (const z of [0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.15, 1.2, 1.25]) {
    await page.setViewportSize({ width: Math.round(1180 / z), height: Math.round(800 / z) });
    await page.goto("/b-systems");
    await page.locator(".nav-strip .app-nav").waitFor();
    await page.waitForTimeout(350); // measure() after layout + the font swap
    const hidden = await clips();
    if (hidden > 0.5) {
      expect(
        await chevrons(),
        `the strip clips ${hidden.toFixed(2)}px at zoom ${z} with no chevron to reach it`,
      ).toBeGreaterThan(0);
    }
  }

  /* (b) FRACTIONAL pixels — what layout zoom alone cannot produce, and where
     the rounded measurement used to lose the chevron */
  await page.setViewportSize({ width: 1180, height: 800 });
  await page.goto("/b-systems");
  await page.locator(".nav-strip .app-nav").waitFor();
  for (const z of [0.98, 1.02, 1.04, 1.06, 1.08, 1.12]) {
    await page.evaluate((v) => {
      document.documentElement.style.zoom = String(v);
    }, z);
    await page.waitForTimeout(250);
    const hidden = await clips();
    if (hidden > 0.5) {
      expect(
        await chevrons(),
        `the strip clips ${hidden.toFixed(2)}px at CSS zoom ${z} with no chevron to reach it`,
      ).toBeGreaterThan(0);
    }
  }
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });
});

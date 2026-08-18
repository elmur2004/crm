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

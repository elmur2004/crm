import { expect, test } from "@playwright/test";

/* Founder (ADR-039): the "didn't answer" marker on the main CRM board — a
   toggle on the card shows a "No answer" badge "just so we know"; clearing it
   removes the badge. A FLAG, not a stage: the card never leaves its column.

   Founder (ADR-064): "make the didn't answer button a counter so we can know
   how many times we tried." Same badge, same column, but the button counts now:
   one press = one attempt, the number rides the badge from the second try on,
   and Answered resets it to nothing. */

test('admin flags a card "Didn\'t answer", sees the badge, then clears it', async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);

  await page.goto("/b-systems/crm");
  /* Scoped to the New column: proves the toggle is not a stage transition. */
  const card = page
    .locator('[data-stage="new"]')
    .locator('[data-deal-card="Delta Fresh Foods"]');
  await expect(card).toBeVisible();
  await expect(card.getByText("No answer", { exact: true })).toHaveCount(0);

  await card.getByRole("button", { name: "Didn't answer" }).click();
  await expect(card.getByText("No answer", { exact: true })).toBeVisible();

  /* The badge also shows on the lead detail header. */
  await card.getByRole("link", { name: "Delta Fresh Foods" }).click();
  await page.waitForURL(/\/b-systems\/crm\/lead\//);
  await expect(page.getByText("No answer", { exact: true })).toBeVisible();

  /* Back on the board: clear it — badge gone, card still in New. */
  await page.goto("/b-systems/crm");
  await card.getByRole("button", { name: "Answered — clear flag" }).click();
  await expect(card.getByText("No answer", { exact: true })).toHaveCount(0);
  await expect(card).toBeVisible();
});

test("the button COUNTS: a second try reads 2, a third reads 3, and Answered wipes it (ADR-064)", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);

  await page.goto("/b-systems/crm");
  const card = page
    .locator('[data-stage="new"]')
    .locator('[data-deal-card="Delta Fresh Foods"]');
  const badge = card.locator(".badge--noanswer");
  const tryAgain = card.getByRole("button", { name: "Didn't answer" });
  await expect(badge).toHaveCount(0);

  /* ONE attempt reads as the plain marker — a bare "· 1" would be noise, and
     the sentence that says what the badge means rides its label */
  await tryAgain.click();
  await expect(badge).toHaveText("No answer");
  await expect(badge).toHaveAttribute("aria-label", "Tried once");
  await expect(badge).toHaveAttribute("title", "Tried once");

  /* the SECOND press is the whole point: it must still be offered, and count */
  await expect(tryAgain).toBeVisible();
  await tryAgain.click();
  await expect(badge).toHaveText("No answer · 2");
  await expect(badge).toHaveAttribute("aria-label", "Tried 2 times");

  await tryAgain.click();
  await expect(badge).toHaveText("No answer · 3");
  /* review — the sentence must be the badge's ACCESSIBLE NAME, not merely an
     attribute in the DOM. `aria-label` on a bare <span> (role=generic) is
     prohibited by ARIA and conforming screen readers drop it, so the badge
     carries role="img"; `getByRole` resolves the computed name and would fail
     if that role were ever removed, which toHaveAttribute alone cannot catch. */
  await expect(card.getByRole("img", { name: "Tried 3 times" })).toBeVisible();

  /* the same number on the lead detail and on the call sheet — one badge,
     one truth, wherever the marker shows */
  await card.getByRole("link", { name: "Delta Fresh Foods" }).click();
  await page.waitForURL(/\/b-systems\/crm\/lead\//);
  const leadUrl = page.url();
  await expect(page.locator(".badge--noanswer")).toHaveText("No answer · 3");
  await page.goto(`${leadUrl}/call`);
  await expect(page.locator(".badge--noanswer")).toHaveText("No answer · 3");

  /* Answered wipes the tally — and counting starts fresh, not resumed */
  await page.goto("/b-systems/crm");
  await card.getByRole("button", { name: "Answered — clear flag" }).click();
  await expect(badge).toHaveCount(0);
  /* with nothing to clear, only the counter button is offered */
  await expect(card.getByRole("button", { name: "Answered — clear flag" })).toHaveCount(0);
  await tryAgain.click();
  await expect(badge).toHaveText("No answer");

  /* leave the seeded card as we found it */
  await card.getByRole("button", { name: "Answered — clear flag" }).click();
  await expect(badge).toHaveCount(0);
});

test("Arabic: the tally reads right-to-left, in real Arabic (ADR-064)", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);

  await page.goto("/b-systems/crm");
  await page.getByRole("button", { name: "عربي" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  const card = page
    .locator('[data-stage="new"]')
    .locator('[data-deal-card="Delta Fresh Foods"]');
  const badge = card.locator(".badge--noanswer");
  const tryAgain = card.getByRole("button", { name: "لم يرد على الاتصال" });

  await tryAgain.click();
  await expect(badge).toHaveText("لم يرد");
  await expect(badge).toHaveAttribute("aria-label", "محاولة واحدة");
  await tryAgain.click();
  /* the Today chip's own "label · n" shape, which already reads correctly in
     RTL; the sentence stays count-agnostic Arabic ("عدد المحاولات: 2") */
  await expect(badge).toHaveText("لم يرد · 2");
  await expect(badge).toHaveAttribute("aria-label", "عدد المحاولات: 2");

  await card.getByRole("button", { name: "تم الرد — إزالة العلامة" }).click();
  await expect(badge).toHaveCount(0);
});

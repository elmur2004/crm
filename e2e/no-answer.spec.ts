import { expect, test } from "@playwright/test";

/* Founder (ADR-039): the "didn't answer" marker on the main CRM board — a
   toggle on the card shows a "No answer" badge "just so we know"; clearing it
   removes the badge. A FLAG, not a stage: the card never leaves its column. */

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

import { expect, test } from "@playwright/test";
import { afterSignIn } from "./helpers/after-sign-in";

/* SPEC §13 journey 2 — ByteForce lost path with reason; dashboard reflects it.
   Runs after journey 1 (serial): asserts by delta where journey 1 left state. */

test("journey 2: ByteForce lost path with reason", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("sara@byteforce.example");
  await page.getByLabel("Password").fill("byteforce123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await afterSignIn(page, /\/b-systems\?company=byteforce$/);

  /* Read current dashboard numbers for delta assertions — from data-value,
     the server value, so no polling is needed (dashboard spec §9.5). */
  const metric = (key: string) =>
    page
      .locator(`[data-metric="${key}"]`)
      .getAttribute("data-value")
      .then((v) => Number(v));
  const totalBefore = await metric("total_leads");
  const lostBefore = await metric("stage:lost");

  /* New lead under the seeded rep. */
  await page.goto("/b-systems/leads?company=byteforce");
  await page.getByRole("link", { name: /Laila Mostafa/ }).click();
  await page.getByRole("button", { name: "Add lead" }).click();
  await page.getByLabel("Name").fill("Lost Cause Ltd");
  await page.getByLabel("Number").fill("01055554444");
  await page.getByLabel("Type").selectOption("cold_call");
  await page.getByRole("button", { name: "Save lead" }).click();
  await page.getByRole("link", { name: "Lost Cause Ltd" }).click();

  /* Next action: Lost — reason is required (T-4). */
  await page.getByLabel("Next action").selectOption("lost");
  await page.getByLabel("Reason (required)").fill("Budget frozen for this year");
  await page.getByRole("button", { name: "Save & move" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Lost")).toBeVisible();
  await expect(page.getByText("Budget frozen for this year")).toBeVisible();

  /* Dashboard reflects the change. */
  await page.goto("/b-systems?company=byteforce");
  expect(await metric("total_leads")).toBe(totalBefore + 1);
  expect(await metric("stage:lost")).toBe(lostBefore + 1);
  /* the Lost bar still prints its stage name and its count as text */
  await expect(page.locator('[data-metric="stage:lost"]')).toContainText("Lost");
  await expect(page.locator('[data-metric="stage:lost"]')).toContainText(String(lostBefore + 1));
});

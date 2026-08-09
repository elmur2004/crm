import { expect, test } from "@playwright/test";

/* SPEC §13 journey 2 — ByteForce lost path with reason; dashboard reflects it.
   Runs after journey 1 (serial): asserts by delta where journey 1 left state. */

test("journey 2: ByteForce lost path with reason", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("sara@byteforce.example");
  await page.getByLabel("Password").fill("byteforce123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/byteforce$/);

  /* Read current dashboard numbers for delta assertions. */
  const totalBefore = Number(
    await page.getByText("Total leads").locator("..").locator("p").nth(1).textContent(),
  );
  const lostBefore = Number(
    await page.getByText("Lost", { exact: true }).locator("..").locator("p").nth(1).textContent(),
  );

  /* New lead under the seeded rep. */
  await page.goto("/byteforce/leads");
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
  await page.goto("/byteforce");
  await expect(
    page.getByText("Total leads").locator("..").getByText(String(totalBefore + 1), { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Lost", { exact: true }).locator("..").getByText(String(lostBefore + 1), { exact: true }),
  ).toBeVisible();
});

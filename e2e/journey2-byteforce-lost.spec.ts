import { expect, test } from "@playwright/test";
import { afterSignIn } from "./helpers/after-sign-in";

/* SPEC §13 journey 2 — ByteForce lost path with reason; dashboard reflects it.
   Runs after journey 1 (serial): asserts by delta where journey 1 left state.

   Founder (2026-11-08, "assigned leads only" — "Both companies now"): Sara is a
   ByteForce teammate who is not the admin, so her Leads page is HER OWN list (no
   owner cards, no other teammate's leads), a lead she adds is automatically
   hers, and the company-wide dashboard is the admin's. So the founder reads the
   dashboard before and after, and Sara does the work in between. */

test("journey 2: ByteForce lost path with reason", async ({ browser }) => {
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto("/login");
  await admin.getByLabel("Email or phone").fill("admin@byteforce.com");
  await admin.getByLabel("Password").fill("password123");
  await admin.getByRole("button", { name: "Sign in" }).click();
  await afterSignIn(admin, /\/b-systems\?company=byteforce$/);

  /* Read current dashboard numbers for delta assertions — from data-value,
     the server value, so no polling is needed (dashboard spec §9.5). */
  const metric = (key: string) =>
    admin
      .locator(`[data-metric="${key}"]`)
      .getAttribute("data-value")
      .then((v) => Number(v));
  const totalBefore = await metric("total_leads");
  const lostBefore = await metric("stage:lost");

  const saraCtx = await browser.newContext();
  const page = await saraCtx.newPage();
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("sara@byteforce.example");
  await page.getByLabel("Password").fill("byteforce123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await afterSignIn(page, /\/b-systems\/crm\?company=byteforce$/);

  /* Her Leads page is her own list: no directory of owners, nobody else's. */
  await page.goto("/b-systems/leads?company=byteforce");
  await expect(page.getByRole("heading", { level: 1, name: "My leads" })).toBeVisible();
  await expect(page.locator("[data-owner-card]")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Laila Mostafa/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Add lead" }).click();
  /* a teammate names no owner — the lead is his by construction */
  await expect(page.getByLabel("Owner (optional)")).toHaveCount(0);
  await page.getByLabel("Name").fill("Lost Cause Ltd");
  await page.getByLabel("Number").fill("01055554444");
  await page.getByLabel("Type").selectOption("cold_call");
  await page.getByRole("button", { name: "Save lead" }).click();
  await page.getByRole("link", { name: "Lost Cause Ltd" }).click();
  await expect(page.locator('[data-field="owner"]')).toContainText("Sara Hassan");

  /* Next action: Lost — reason is required (T-4). No hand-over select: that
     is the admin's alone. */
  await page.getByLabel("Next action").selectOption("lost");
  await page.getByLabel("Reason (required)").fill("Budget frozen for this year");
  await page.getByRole("button", { name: "Save & move" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Lost")).toBeVisible();
  await expect(page.getByText("Budget frozen for this year")).toBeVisible();

  /* …and the company dashboard is not hers: it sends her to her board */
  await page.goto("/b-systems?company=byteforce");
  await expect(page).toHaveURL(/\/b-systems\/crm\?company=byteforce$/);

  /* The admin's dashboard reflects the change. */
  await admin.goto("/b-systems?company=byteforce");
  expect(await metric("total_leads")).toBe(totalBefore + 1);
  expect(await metric("stage:lost")).toBe(lostBefore + 1);
  /* the Lost bar still prints its stage name and its count as text */
  await expect(admin.locator('[data-metric="stage:lost"]')).toContainText("Lost");
  await expect(admin.locator('[data-metric="stage:lost"]')).toContainText(String(lostBefore + 1));
  await saraCtx.close();
  await adminCtx.close();
});

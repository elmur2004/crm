import { expect, test } from "@playwright/test";

/* Founder: impersonation snaps BACK AND FORTH — the admin enters any account,
   sees a persistent bar, and one click returns to the admin session. */

test("admin impersonates an agent, sees their app, and snaps back to admin", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);

  /* Impersonate the seeded agent from Users. */
  await page.goto("/b-systems/users");
  await page
    .getByRole("row", { name: /Karim Adel/ })
    .getByRole("button", { name: "Impersonate" })
    .click();

  /* Now inside the agent's app, with the snap-back bar visible. */
  await page.waitForURL(/\/b-systems\/crm$/);
  await expect(page.getByText("Impersonating Karim Adel", { exact: false })).toBeVisible();
  await expect(page.getByText("Fresh Deal")).toBeVisible(); // the agent's own board

  /* One click → back to the admin, bar gone, admin sections back. */
  await page.getByRole("button", { name: "Back to admin" }).click();
  await page.waitForURL(/\/b-systems$/);
  await expect(page.getByText("Impersonating", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
});

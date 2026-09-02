import { expect, test } from "@playwright/test";

/* Founder: impersonation snaps BACK AND FORTH — the admin enters any account,
   sees a persistent bar, and one click returns to the admin session. */

test("admin impersonates an agent, sees their app, and snaps back to admin", async ({ page }) => {
  /* ADR-073 — the budget, not the assertions.

     This is the only case in the suite that performs THREE server-side auth
     round trips in one test: sign in as the admin, mint an impersonation
     session, then snap back. On the default 60s it began tipping as the suite
     grew — always the same way, a sign-in POST returning to /login and the test
     spending its whole budget on one `waitForURL`. It passes alone, in batches,
     and in the same pair that reproduced it once; only a loaded machine tips
     it. The same accommodation qa-sweep's sweeps already carry, and for the
     same reason: the clock was never the thing under test. */
  test.setTimeout(180_000);
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

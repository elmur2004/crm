import { expect, test } from "@playwright/test";

/* Founder V5 — the AR ↔ EN toggle: switching flips the whole document to
   Arabic RTL and back; the choice survives navigation (cookie). */

test("the language toggle flips the app to Arabic (RTL) and back", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { name: "One door, every account." })).toBeVisible();

  await page.getByRole("button", { name: "عربي" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.getByRole("heading", { name: "باب واحد لكل الحسابات." })).toBeVisible();

  /* The choice sticks after sign-in — the admin shell renders Arabic too. */
  await page.getByLabel("كلمة المرور").fill("password123");
  await page.getByPlaceholder(/you@company\.com|01012345678|البريد/).fill("admin@byteforce.com");
  await page.getByRole("button", { name: /تسجيل الدخول/ }).click();
  await expect(page).toHaveURL(/\/b-systems$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  /* Back to English from the app header. */
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

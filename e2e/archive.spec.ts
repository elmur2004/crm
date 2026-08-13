import { expect, test } from "@playwright/test";

/* ADR-043 smoke: archive from the lead detail → the card leaves the board and
   the default list → the Archived view still has it → unarchive restores it. */

test("archive a lead from the detail; it leaves the board; the Archived view restores it", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);

  const created = await page.request.post("/api/b-systems/leads", {
    data: {
      name: "Archive Smoke Lead",
      number: "0108880001",
      type: "cold_call",
      companyName: "Archive Co",
    },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  /* On the board (New column) before archiving. */
  await page.goto("/b-systems/crm");
  await expect(page.locator('[data-deal-card="Archive Smoke Lead"]')).toBeVisible();

  /* Archive from the detail — inline confirm, then the header badge shows. */
  await page.goto(`/b-systems/crm/lead/${id}`);
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page.getByText("Archived", { exact: true })).toBeVisible();

  /* Gone from the board and the default Leads view. */
  await page.goto("/b-systems/crm");
  await expect(page.locator('[data-deal-card="Archive Smoke Lead"]')).toHaveCount(0);
  await page.goto("/b-systems/leads");
  await expect(page.getByRole("link", { name: "Archive Smoke Lead" })).toHaveCount(0);

  /* The Archived view IS the archive. */
  await page.goto("/b-systems/leads?view=archived");
  await expect(page.getByRole("link", { name: "Archive Smoke Lead" })).toBeVisible();

  /* Unarchive from the detail → back on the board. */
  await page.goto(`/b-systems/crm/lead/${id}`);
  await page.getByRole("button", { name: "Unarchive" }).click();
  await expect(page.getByRole("button", { name: "Archive", exact: true })).toBeVisible();
  await page.goto("/b-systems/crm");
  await expect(page.locator('[data-deal-card="Archive Smoke Lead"]')).toBeVisible();
});

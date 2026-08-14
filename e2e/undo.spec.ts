import { expect, test } from "@playwright/test";

/* ADR-045 smoke: the admin moves a card on the board, the header offers to undo
   exactly that move, one click puts the card back, and the control goes quiet. */

test("admin moves a card, undoes it from the header, and the card is back", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);

  const created = await page.request.post("/api/b-systems/leads", {
    data: {
      name: "Undo Smoke Lead",
      number: "0107775001",
      type: "cold_call",
      companyName: "Undo Smoke Co",
    },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  /* Move it New → Following up through the same API the board's drag uses. */
  const moved = await page.request.post(`/api/b-systems/leads/${id}/event`, {
    data: {
      event: { type: "next_action", action: "following_up" },
      group: { group: "follow_up", data: { date: "2026-09-01", time: "10:00", method: "call" } },
    },
  });
  expect(moved.ok()).toBe(true);

  await page.goto("/b-systems/crm");
  await expect(
    page.locator('[data-stage="following_up"] [data-deal-card="Undo Smoke Lead"]'),
  ).toBeVisible();
  /* the header names exactly what it will revert — the newest action wins */
  await expect(page.getByText("Moved Undo Smoke Lead to Following Up")).toBeVisible();

  /* One click, no confirmation — an undo IS the confirmation. */
  await page.getByRole("button", { name: /^Undo:/ }).click();
  await expect(page.getByText("Undone: Moved Undo Smoke Lead to Following Up")).toBeVisible();

  /* Back in the New column, and the header control is quiet again. */
  await page.goto("/b-systems/crm");
  await expect(page.locator('[data-stage="new"] [data-deal-card="Undo Smoke Lead"]')).toBeVisible();
  await expect(
    page.locator('[data-stage="following_up"] [data-deal-card="Undo Smoke Lead"]'),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Undo:/ })).toHaveCount(0);

  /* Cleanup. Deleting is not undoable, so the header stays quiet after it too. */
  expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
  await page.goto("/b-systems/crm");
  await expect(page.getByRole("button", { name: /^Undo:/ })).toHaveCount(0);
});

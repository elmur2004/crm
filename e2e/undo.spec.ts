import { expect, test } from "@playwright/test";

/* ADR-082 — follow-up dates are RELATIVE to today. A hardcoded date silently
   drifts into the past, and a past date now puts the card in the derived
   "Fallen behind" column instead of Following Up — which would fail this spec
   for a reason that has nothing to do with its subject. */
const cairoDate = (offsetDays = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(
    new Date(Date.now() + offsetDays * 86_400_000),
  );

/* the app's own rendering (lib/datetime formatCairo) — same Node, same ICU */
const cairoDateLabel = (offsetDays = 0) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.now() + offsetDays * 86_400_000));

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
      group: { group: "follow_up", data: { date: cairoDate(1), time: "10:00", method: "call" } },
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

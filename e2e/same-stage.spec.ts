import { expect, test } from "@playwright/test";

/* Founder (same-stage records): "if I followed up with them and they need
   another follow-up, add a button inside the lead". The button records a
   SECOND follow-up from the lead detail; the card stays in Following Up and
   the To-Do swaps to the new date. Setup drives the existing APIs; only the
   new button is exercised through the UI. */

test("the lead detail records another follow-up without leaving Following Up", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);

  const created = await page.request.post("/api/b-systems/leads", {
    data: {
      name: "Again Smoke Lead",
      number: "0106660001",
      type: "cold_call",
      companyName: "Again Co",
    },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  const moved = await page.request.post(`/api/b-systems/leads/${id}/event`, {
    data: {
      event: { type: "next_action", action: "following_up" },
      group: { group: "follow_up", data: { date: "2026-09-01", time: "10:00", method: "call" } },
    },
  });
  expect(moved.ok()).toBeTruthy();

  await page.goto(`/b-systems/crm/lead/${id}`);
  await page.getByRole("button", { name: "Log another follow-up" }).click();
  await page.getByLabel("Follow-up date").fill("2026-09-08");
  await page.getByLabel("Follow-up time").fill("15:30");
  await page.getByRole("button", { name: "Save record" }).click();

  /* two follow-up records now, and the stage badge has not moved */
  await expect(page.getByText("Following up", { exact: true })).toHaveCount(2);
  /* month abbreviation is ICU-dependent in en-GB ("Sep" / "Sept") — the day,
     year and time are the part that proves the NEW record landed */
  await expect(page.getByText(/8 Sept? 2026, 15:30/)).toBeVisible();

  await page.goto("/b-systems/crm");
  await expect(
    page.locator('[data-stage="following_up"] [data-deal-card="Again Smoke Lead"]'),
  ).toBeVisible();

  /* cleanup so the shared seed database stays predictable for later specs */
  expect((await page.request.delete(`/api/b-systems/leads/${id}`)).ok()).toBe(true);
});

import { expect, test } from "@playwright/test";

/* ADR-041 smoke: a follow-up dated today (Cairo) shows on /b-systems/todo and
   clicks through to its lead. Setup drives the existing APIs — no new surface,
   no flaky UI choreography. */

test("admin sees today's follow-up on the To-Do page and opens the lead", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/b-systems$/);

  /* Create a lead and move it to Following Up, due today (Cairo wall date). */
  const created = await page.request.post("/api/b-systems/leads", {
    data: { name: "Todo Smoke Lead", number: "0109990001", type: "cold_call", companyName: "Todo Co" },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
  const moved = await page.request.post(`/api/b-systems/leads/${id}/event`, {
    data: {
      event: { type: "drag", to: "following_up" },
      group: { group: "follow_up", data: { date: today, time: "23:59", method: "call" } },
    },
  });
  expect(moved.ok()).toBeTruthy();

  await page.goto("/b-systems/todo");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("To-Do");
  const row = page.getByRole("link", { name: "Todo Smoke Lead" });
  await expect(row).toBeVisible();
  await row.click();
  await page.waitForURL(/\/b-systems\/crm\/lead\//);
  await expect(page.getByText("Todo Smoke Lead").first()).toBeVisible();
});

import { expect, test, type Locator, type Page } from "@playwright/test";

/* ADR-042 — ByteForce board parity with the B-Systems board: drag opens the
   stage's INTERNAL form (drop = the matching Next Action), whole-card click
   opens the lead, and the didn't-answer marker toggles on this board too. */

async function dragTo(page: Page, card: Locator, column: Locator) {
  const from = (await card.boundingBox())!;
  const to = (await column.boundingBox())!;
  /* grab the card's middle-right edge — clear of the name link and the
     bottom didn't-answer button — and cross the sensor distance first */
  await page.mouse.move(from.x + from.width - 10, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width - 10, from.y + from.height / 2 + 12, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 14 });
  await page.mouse.up();
}

test("ByteForce board: drag opens the stage form; didn't-answer toggles; whole card opens the lead", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("sara@byteforce.example");
  await page.getByLabel("Password").fill("byteforce123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/byteforce$/);

  const created = await page.request.post("/api/byteforce/leads", {
    data: { name: "Parity Deal", number: "01055512345", type: "cold_call" },
  });
  expect(created.status()).toBe(201);

  await page.goto("/byteforce/crm");
  const card = page.locator('[data-deal-card="Parity Deal"]');
  await expect(card).toBeVisible();

  /* Drag New → Following Up: the FULL internal follow-up form opens. */
  await dragTo(page, card, page.locator('[data-stage="following_up"]'));
  await expect(page.getByText("Complete this stage's details to confirm the move")).toBeVisible();
  await page.getByLabel("Follow-up date").fill("2026-10-01");
  await page.getByLabel("Follow-up time").fill("10:00");
  await page.getByLabel("Method").selectOption("call");
  await page.getByRole("button", { name: "Confirm move" }).click();
  await expect(
    page.locator('[data-stage="following_up"]').getByText("Parity Deal"),
  ).toBeVisible();

  /* Didn't answer: chip appears; clearing removes it. */
  await card.getByRole("button", { name: "Didn't answer" }).click();
  await expect(card.getByText("No answer", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Answered — clear flag" }).click();
  await expect(card.getByText("No answer", { exact: true })).toHaveCount(0);

  /* Whole card opens the lead — clicked on its subtitle line: plain text that
     bubbles to the card handler. The geometric center is no longer neutral
     ground (the chips row now carries Call + WhatsApp, which swallow clicks
     on purpose). */
  await card.locator(".bcard-rep").click();
  await page.waitForURL(/\/byteforce\/leads\/lead\//);
  await expect(page.getByText("Parity Deal").first()).toBeVisible();
});

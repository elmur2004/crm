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
  /* the travel can auto-scroll the board — land on the column's LIVE box so
     the drop cannot drift into a neighbour */
  const settled = (await column.boundingBox())!;
  await page.mouse.move(settled.x + settled.width / 2, settled.y + 60, { steps: 2 });
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

/* Founder: "the CRM is becoming very long because one column is long — add a
   slider in the column itself when it passes five leads or something." The
   column now caps its own height and scrolls inside; a card revealed by that
   inner scroll must still drag out to another stage (DragOverlay carries the
   visual, so the clipped column no longer traps it). */
test("a long column scrolls inside itself and a scrolled-to card still drags out", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("sara@byteforce.example");
  await page.getByLabel("Password").fill("byteforce123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/byteforce$/);

  const ids: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const res = await page.request.post("/api/byteforce/leads", {
      data: { name: `Cap Lead ${i}`, number: `010200000${i}0`, type: "cold_call" },
    });
    expect(res.status()).toBe(201);
    ids.push(((await res.json()) as { id: string }).id);
  }

  await page.goto("/byteforce/crm");
  const list = page.locator('[data-stage="new"] .col-cards');
  await expect(list.locator('[data-deal-card^="Cap Lead"]')).toHaveCount(7);

  /* capped and scrollable INSIDE — the page no longer stretches with it */
  const capped = await list.evaluate(
    (el) => el.scrollHeight > el.clientHeight && el.clientHeight <= 520,
  );
  expect(capped).toBe(true);

  /* the DOM-last card needs the inner scroll to be reached; once reached it
     drags out exactly like any other card */
  const deep = list.locator('[data-deal-card^="Cap Lead"]').last();
  const deepName = (await deep.getAttribute("data-deal-card"))!;
  await deep.scrollIntoViewIfNeeded();
  await dragTo(page, deep, page.locator('[data-stage="following_up"]'));
  await expect(page.getByText("Complete this stage's details to confirm the move")).toBeVisible();
  await page.getByLabel("Follow-up date").fill("2026-10-02");
  await page.getByLabel("Follow-up time").fill("09:30");
  await page.getByLabel("Method").selectOption("call");
  await page.getByRole("button", { name: "Confirm move" }).click();
  await expect(
    page.locator(`[data-stage="following_up"] [data-deal-card="${deepName}"]`),
  ).toBeVisible();

  /* clean up by ARCHIVING (ADR-043: archived leaves the board) — the
     ByteForce API deliberately has no lead delete */
  for (const id of ids) {
    const res = await page.request.post(`/api/byteforce/leads/${id}/archive`, {
      data: { value: true },
    });
    expect(res.ok()).toBe(true);
  }
});

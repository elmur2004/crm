import { expect, test, type Locator, type Page } from "@playwright/test";

/* ADR-042 — ByteForce board parity with the B-Systems board: drag opens the
   stage's INTERNAL form (drop = the matching Next Action), whole-card click
   opens the lead, and the didn't-answer marker toggles on this board too. */

async function dragTo(page: Page, card: Locator, column: Locator) {
  /* ADR-072 widened this board by a column, and a wider board is exactly what
     ADR-059 taught prospect-pipeline.spec: scroll BOTH ends into view before
     measuring, or `page.mouse` — which speaks VIEWPORT coordinates — aims at a
     column that is past the fold, gets clamped at the edge, and drops the card
     on whichever column happens to sit there. That failure is silent: the drop
     succeeds, on the wrong column. */
  await column.scrollIntoViewIfNeeded();
  await card.scrollIntoViewIfNeeded();
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
  await page.waitForURL(/\/b-systems\?company=byteforce$/);

  const created = await page.request.post("/api/byteforce/leads", {
    data: { name: "Parity Deal", number: "01055512345", type: "cold_call" },
  });
  expect(created.status()).toBe(201);

  await page.goto("/b-systems/crm?company=byteforce");
  const card = page.locator('[data-deal-card="Parity Deal"]');
  await expect(card).toBeVisible();

  /* Drag New → Following Up: the FULL internal follow-up form opens — a
     required DAY and, since ADR-063, an OPTIONAL time. Left blank here, so the
     card must still read date-only (the ADR-061 norm). */
  await dragTo(page, card, page.locator('[data-stage="following_up"]'));
  await expect(page.getByText("Complete this stage's details to confirm the move")).toBeVisible();
  await expect(page.getByLabel("Follow-up date")).toBeVisible();
  await expect(page.getByLabel("Follow-up time (optional)")).toBeVisible(); // ADR-063
  await page.getByLabel("Follow-up date").fill("2026-10-01");
  await page.getByLabel("Method").selectOption("call");
  await page.getByRole("button", { name: "Confirm move" }).click();
  const movedCard = page.locator('[data-stage="following_up"] [data-deal-card="Parity Deal"]');
  await expect(movedCard).toBeVisible();
  /* …and with the time left blank the follow-up renders DATE-ONLY on the
     card's key datum — no 9:00 AM nobody chose (ADR-063) */
  await expect(movedCard).toContainText("Next: 1 Oct 2026");
  await expect(movedCard).not.toContainText("1 Oct 2026, ");

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
  await page.waitForURL(/\/b-systems\/leads\/lead\//);
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
  await page.waitForURL(/\/b-systems\?company=byteforce$/);

  const ids: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const res = await page.request.post("/api/byteforce/leads", {
      data: { name: `Cap Lead ${i}`, number: `010200000${i}0`, type: "cold_call" },
    });
    expect(res.status()).toBe(201);
    ids.push(((await res.json()) as { id: string }).id);
  }

  await page.goto("/b-systems/crm?company=byteforce");
  const list = page.locator('[data-stage="new"] .col-cards');
  await expect(list.locator('[data-deal-card^="Cap Lead"]')).toHaveCount(7);

  /* capped and scrollable INSIDE — the page no longer stretches with it.
     Measured against the LIVE cap, never a literal: the cap used to be a flat
     `min(62vh, 510px)`, where `<= 520` held at every viewport height, and is
     now `clamp(floor, 62vh, ceiling)` — so a bare literal would be pinned to
     whatever viewport this file happens to run at (1280x720 by default; the
     suite already runs other specs at 900px tall, where the same expression
     resolves to 558). The clamp is re-derived here from the card constants the
     CSS itself declares, so this stays true at any viewport. */
  const cap = await list.evaluate((el) => {
    const cs = getComputedStyle(el);
    const px = (name: string) => parseFloat(cs.getPropertyValue(name));
    const floor = 2 * px("--bcard-h-max") + px("--bcard-gap") + px("--col-cards-pad-b");
    const ceiling = 5 * px("--bcard-h") + 4 * px("--bcard-gap") + px("--col-cards-pad-b");
    return {
      scrollsInside: el.scrollHeight > el.clientHeight,
      clientHeight: el.clientHeight,
      expected: Math.min(Math.max(0.62 * window.innerHeight, floor), ceiling),
    };
  });
  expect(cap.scrollsInside, "the long column must scroll inside itself").toBe(true);
  expect(cap.clientHeight, `the column is not at its declared cap`).toBeLessThanOrEqual(
    cap.expected + 1,
  );

  /* the DOM-last card needs the inner scroll to be reached; once reached it
     drags out exactly like any other card */
  const deep = list.locator('[data-deal-card^="Cap Lead"]').last();
  const deepName = (await deep.getAttribute("data-deal-card"))!;
  await deep.scrollIntoViewIfNeeded();
  await dragTo(page, deep, page.locator('[data-stage="following_up"]'));
  await expect(page.getByText("Complete this stage's details to confirm the move")).toBeVisible();
  await page.getByLabel("Follow-up date").fill("2026-10-02");
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

import { expect, test, type Locator, type Page } from "@playwright/test";

/* V2 §6 journey 3 — Partners & Agents, the PARTNER card (ADMIN-owned in V2):
   prospect with mp3 record → Didn't Answer records WHICH number went unanswered
   (no new number required) → an alternative number added later auto-returns the
   card to Lead (unbounded loop) → simplified meeting (date+time+mode) → Won gate
   blocks until fields complete → Partner in directory → attributed partner lead
   lands on the unified board and moves through the pipeline. */

const MP3 = Buffer.concat([Buffer.from("ID3"), Buffer.alloc(4096, 1)]);

test("journey 3: partnership acquisition to attributed CRM lead (V2 numbers flow)", async ({
  page,
}) => {
  /* V2: the Partners & Agents board belongs to the ADMIN. */
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/b-systems$/);

  /* Create the prospect (§7.2 Lead stage fields). */
  await page.goto("/b-systems/partners-pipeline");
  await page.getByRole("button", { name: "Add partner or agent" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Dina Fawzy");
  await page.getByLabel("Company name").fill("Fawzy Logistics");
  await page.getByLabel("Number", { exact: true }).fill("0227654321");
  /* fixed dropdown; "Other activities" opens the free-text box */
  await page.getByLabel("Business activity").selectOption("Other activities");
  await page.getByLabel("Specify the activity").fill("Freight & logistics");
  await page.getByRole("button", { name: "Save card" }).click();
  const card = page.getByRole("link", { name: /Fawzy Logistics/ });
  await expect(card).toBeVisible();

  /* Prospect detail — upload an mp3 cold-call recording, playable inline. */
  await card.click();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "cold-call.mp3", mimeType: "audio/mpeg", buffer: MP3 });
  await page.getByRole("button", { name: "Upload recording" }).click();
  await expect(page.getByText("cold-call.mp3")).toBeVisible();
  await expect(page.locator("audio")).toBeVisible();

  /* PP-1 (V2 §6): Didn't Answer asks WHICH number(s) went unanswered — the
     card's single number is pre-checked; NO new number is demanded. */
  await page.getByLabel("Next action").selectOption("didnt_answer");
  await expect(page.getByText("Number dialed — which number(s) went unanswered?")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "0227654321" })).toBeChecked();
  await page.getByRole("button", { name: "Save & move" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Didn't Answer")).toBeVisible();

  /* PP-2 (V2 §6): an alternative number added later auto-returns the card to Lead. */
  await expect(
    page.getByText("Saving new number(s) returns this card to Lead automatically"),
  ).toBeVisible();
  await page.getByLabel("New number 1").fill("0101230000");
  await page.getByRole("button", { name: "Save numbers" }).click();
  await expect(
    page.getByRole("heading", { level: 1 }).getByText("Lead", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("[PP-2]")).toBeVisible(); // history entry
  await expect(page.getByText("0101230000")).toBeVisible(); // alternative listed on the card

  /* V2 §6 — the partnership meeting is simplified: date + time + online/offline. */
  await page.getByLabel("Next action").selectOption("meeting_setting");
  await page.getByLabel("Date", { exact: true }).fill("2026-09-15");
  await page.getByLabel("Time", { exact: true }).fill("13:00");
  await page.getByLabel("Mode").selectOption("offline");
  await page.getByRole("button", { name: "Save & move" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Meeting Setting")).toBeVisible();

  /* Attended → Qualified: the completeness gate blocks until every §7.2 field is
     present — and (ADR-059) it never asks for an email or a password. */
  await page.getByLabel("Meeting outcome").selectOption("attended");
  await page.getByLabel("Destination").selectOption("qualified");
  await expect(
    page.getByText("Qualified saves only when the partner record is complete"),
  ).toBeVisible();
  const gate = page.locator("form").filter({ hasText: "Qualified saves only when" });
  await expect(gate.getByLabel("Password")).toHaveCount(0);
  await page.getByRole("button", { name: /Confirm — move to Qualified/ }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Meeting Setting")).toBeVisible(); // gate held

  await page.getByLabel("Key person role").fill("Managing Director");
  await page.getByLabel("Address").fill("7 Port Said St, Alexandria");
  await page.getByRole("button", { name: /Confirm — move to Qualified/ }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Qualified")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Converted")).toBeVisible(); // A-5 badge

  /* Partner in the directory with Date joined. */
  await page.goto("/b-systems/partners");
  await page.getByRole("link", { name: /Fawzy Logistics/ }).click();
  await expect(page.getByText(/Date joined:/)).toBeVisible();
  await expect(page.getByText("Managing Director")).toBeVisible();

  /* §7.4 / PP-5: add a lead from this partner; it lands on the unified board. */
  await page.getByRole("button", { name: "Add lead" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Referred Retail Co");
  await page.getByLabel("Number", { exact: true }).fill("0111222333");
  await page.getByLabel("Type").selectOption("personal_connection");
  await page.getByRole("button", { name: "Save lead" }).click();
  const leadRow = page.getByRole("link", { name: "Referred Retail Co" });
  await expect(leadRow).toBeVisible();

  /* The unified lead detail carries the attribution and the FULL admin form. */
  await leadRow.click();
  await expect(page).toHaveURL(/\/b-systems\/crm\/lead\//);

  /* founder V5: the lead mini chat — post a message with an @mention and see
     it in the thread with the mention highlighted. */
  const chatBox = page.getByLabel("Message the team");
  await chatBox.fill("Full picture please: @Elmur they asked for a revised quote");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".chat-body")).toContainText("revised quote");
  await expect(page.locator(".chat-mention")).toHaveText("@Elmur");
  await page.getByLabel("Next action").selectOption("following_up");
  await page.getByLabel("Follow-up date").fill("2026-09-20");
  await page.getByLabel("Method").selectOption("call");
  await page.getByRole("button", { name: "Save & move" }).click();
  await expect(page.getByText("Following Up").first()).toBeVisible();

  /* Board card (Partners filter) bears the partner attribution; the partner
     table shows the live stage — a link, not a copy. */
  await page.goto("/b-systems/crm?owner=partner");
  const boardCard = page.locator('[data-deal-card="Referred Retail Co"]');
  await expect(boardCard).toBeVisible();
  await expect(boardCard.getByText(/Fawzy Logistics/)).toBeVisible();
  await page.goto("/b-systems/partners");
  await page.getByRole("link", { name: /Fawzy Logistics/ }).click();
  await expect(
    page.getByRole("row", { name: /Referred Retail Co/ }).getByText("Following Up"),
  ).toBeVisible();
});

/* Founder V4 — the Partners & Agents board drags like the main CRM, and the
   admin can edit + delete a card from its detail page. */

async function dragTo(page: Page, card: Locator, column: Locator) {
  /* grab the SUBTITLE line — plain text with no handlers of its own, so the
     pointer reaches the card's drag listeners. Edge geometry is no longer
     safe ground: the chips row (kind + Call + WhatsApp) swallows pointerdown
     on purpose, and where it sits depends on the card's height. */
  await column.scrollIntoViewIfNeeded();
  const from = (await card.locator(".bcard-rep").boundingBox())!;
  const to = (await column.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 12, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 14 });
  /* the travel can auto-scroll the board — land on the column's LIVE box so
     the drop cannot drift into a neighbour */
  const settled = (await column.boundingBox())!;
  await page.mouse.move(settled.x + settled.width / 2, settled.y + 60, { steps: 2 });
  await page.mouse.up();
}

test("founder V4: partners board drag opens the stage form; edit + delete from detail", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/b-systems$/);

  /* A fresh card to drag. */
  await page.goto("/b-systems/partners-pipeline");
  await page.getByRole("button", { name: "Add partner or agent" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Omar Draggy");
  await page.getByLabel("Company name").fill("Draggy Freight");
  await page.getByLabel("Number", { exact: true }).fill("0100000123");
  await page.getByLabel("Business activity").selectOption("HR company");
  await page.getByRole("button", { name: "Save card" }).click();
  const card = page.locator('[data-deal-card="Draggy Freight"]');
  await expect(card).toBeVisible();

  /* Drag Lead → Didn't Answer: the numbers form opens; the card's single
     number is pre-checked; confirming commits the move. */
  /* ADR-059 — ONE board again, so the column locators are bare stage ids. */
  await dragTo(page, card, page.locator('[data-stage="didnt_answer"]'));
  await expect(page.getByText("Number dialed — which number(s) went unanswered?")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "0100000123" })).toBeChecked();
  await page.getByRole("button", { name: "Confirm move" }).click();
  await expect(
    page.locator('[data-stage="didnt_answer"] [data-deal-card="Draggy Freight"]'),
  ).toBeVisible();

  /* Drag back to Lead: intake return commits directly — no form. */
  await dragTo(page, card, page.locator('[data-stage="lead"]'));
  await expect(
    page.locator('[data-stage="lead"] [data-deal-card="Draggy Freight"]'),
  ).toBeVisible();

  /* Detail page: the admin edits the card in place... */
  await page.getByRole("link", { name: /Draggy Freight/ }).click();
  await page.getByRole("button", { name: "Edit" }).click();
  const editModal = page.locator(".modal");
  await editModal.getByLabel("Company name").fill("Draggy Freight Intl");
  await editModal.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Draggy Freight Intl")).toBeVisible();

  /* ...and deletes it — confirm step, then back on a board without the card. */
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Yes, delete" }).click();
  await expect(page).toHaveURL(/\/b-systems\/partners-pipeline$/);
  await expect(page.locator('[data-deal-card="Draggy Freight Intl"]')).toHaveCount(0);
});

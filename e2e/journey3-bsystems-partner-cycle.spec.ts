import { expect, test } from "@playwright/test";

/* SPEC §13 journey 3 — B-Systems partner cycle:
   prospect with mp3 record → Didn't Answer → add Number 2 → auto-return to Lead →
   Meeting → Won gate blocks until fields complete → Partner in directory with date
   joined → add partner lead → Next Action → CRM card bears "Partner: {Company}". */

const MP3 = Buffer.concat([Buffer.from("ID3"), Buffer.alloc(4096, 1)]);

test("journey 3: B-Systems partner acquisition to attributed CRM lead", async ({ page }) => {
  /* Log in as B-Systems staff. */
  await page.goto("/b-systems/login");
  await page.getByLabel("Email").fill("omar@b-systems.example");
  await page.getByLabel("Password").fill("bsystems123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/b-systems$/);

  /* Create the prospect (§7.2 Lead stage fields). */
  await page.goto("/b-systems/partners-pipeline");
  await page.getByRole("button", { name: "Add partner lead" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Dina Fawzy");
  await page.getByLabel("Company name").fill("Fawzy Logistics");
  await page.getByLabel("Number", { exact: true }).fill("0227654321");
  await page.getByLabel("Business activity").fill("Freight & logistics");
  await page.getByRole("button", { name: "Save partner lead" }).click();
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

  /* PP-1: Didn't answer — number slots revealed. */
  await page.getByLabel("Next action").selectOption("didnt_answer");
  await page.getByRole("button", { name: "Save & move" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Didn't Answer")).toBeVisible();
  await expect(page.getByText("Saving a new number returns this card to Lead")).toBeVisible();

  /* PP-2: a new Number 2 auto-returns the card to Lead. */
  await page.getByLabel("Number 2").fill("0101230000");
  await page.getByRole("button", { name: "Save numbers" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Lead", { exact: true })).toBeVisible();
  await expect(page.getByText("[PP-2]")).toBeVisible(); // history entry

  /* Meeting setting, arranged. */
  await page.getByLabel("Next action").selectOption("meeting_setting");
  await page.getByText("Arranged?").click();
  await page.getByLabel("Date", { exact: true }).fill("2026-09-15");
  await page.getByLabel("Time", { exact: true }).fill("13:00");
  await page.getByLabel("Mode").selectOption("offline");
  await page.getByRole("button", { name: "Save & move" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Meeting Setting")).toBeVisible();

  /* Attended → Won: the completeness gate blocks until every §7.2 field is present. */
  await page.getByLabel("Meeting outcome").selectOption("attended");
  await page.getByLabel("Destination").selectOption("won");
  await expect(page.getByText("Won saves only when the partner record is complete")).toBeVisible();
  /* Key person role + Address are empty — required fields block the submit. */
  await page.getByRole("button", { name: /Confirm — move to Won/ }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Meeting Setting")).toBeVisible(); // gate held

  await page.getByLabel("Key person role").fill("Managing Director");
  await page.getByLabel("Address").fill("7 Port Said St, Alexandria");
  await page.getByRole("button", { name: /Confirm — move to Won/ }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Won")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Converted")).toBeVisible(); // A-5 badge

  /* Partner in the directory with Date joined. */
  await page.goto("/b-systems/partners");
  await page.getByRole("link", { name: /Fawzy Logistics/ }).click();
  await expect(page.getByText(/Date joined:/)).toBeVisible();
  await expect(page.getByText("Managing Director")).toBeVisible();

  /* §7.4 / PP-5: add a lead from this partner, then move it — attribution sticks. */
  await page.getByRole("button", { name: "Add lead" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Referred Retail Co");
  await page.getByLabel("Number", { exact: true }).fill("0111222333");
  await page.getByLabel("Type").selectOption("personal_connection");
  await page.getByRole("button", { name: "Save lead" }).click();
  const leadRow = page.getByRole("link", { name: "Referred Retail Co" });
  await expect(leadRow).toBeVisible();

  await leadRow.click();
  await expect(page.getByText("Partner: Fawzy Logistics").first()).toBeVisible(); // badge in detail
  await page.getByLabel("Next action").selectOption("following_up");
  await page.getByLabel("Follow-up date").fill("2026-09-20");
  await page.getByLabel("Follow-up time").fill("10:30");
  await page.getByLabel("Method").selectOption("call");
  await page.getByRole("button", { name: "Save & move" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Following Up")).toBeVisible();

  /* CRM board card bears the permanent badge; partner table shows the live stage. */
  await page.goto("/b-systems/crm");
  await expect(page.getByText("Partner: Fawzy Logistics").first()).toBeVisible();
  await page.goto("/b-systems/partners");
  await page.getByRole("link", { name: /Fawzy Logistics/ }).click();
  await expect(
    page.getByRole("row", { name: /Referred Retail Co/ }).getByText("Following Up"),
  ).toBeVisible();
});

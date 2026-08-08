import { expect, test } from "@playwright/test";

/* SPEC §13 journey 1 — ByteForce full cycle:
   add rep → add lead → Following Up → Meeting (attended → proposal) → Sent ✓ →
   auto Following Up (after proposal) → Won → Client card exists → dashboard numbers
   correct. Runs first against the freshly seeded e2e DB (absolute assertions). */

test.describe.configure({ mode: "serial" });

test("journey 1: ByteForce full cycle to Won", async ({ page }) => {
  /* Log in as ByteForce staff. */
  await page.goto("/byteforce/login");
  await page.getByLabel("Email").fill("sara@byteforce.example");
  await page.getByLabel("Password").fill("byteforce123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/byteforce$/);

  /* Add a sales rep (§6.1 — reps unlimited). */
  await page.goto("/byteforce/leads");
  await page.getByRole("button", { name: "Add sales rep" }).click();
  await page.getByLabel("Rep name").fill("Journey Rep");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const repCard = page.getByRole("link", { name: /Journey Rep/ });
  await expect(repCard).toBeVisible();

  /* Open the rep's leads table and add a lead. */
  await repCard.click();
  await page.getByRole("button", { name: "Add lead" }).click();
  await page.getByLabel("Name").fill("Journey Lead Co");
  await page.getByLabel("Number").fill("01099998888");
  await page.getByLabel("Type").selectOption("event_data");
  await page.getByRole("button", { name: "Save lead" }).click();
  const leadLink = page.getByRole("link", { name: "Journey Lead Co" });
  await expect(leadLink).toBeVisible();

  /* Lead detail — Next action: Following up (T-1). */
  await leadLink.click();
  await page.getByLabel("Next action").selectOption("following_up");
  await page.getByLabel("Follow-up date").fill("2026-09-01");
  await page.getByLabel("Follow-up time").fill("10:00");
  await page.getByLabel("Method").selectOption("call");
  await page.getByRole("button", { name: "Save & move" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Following Up")).toBeVisible();

  /* Next action: Meeting setting (T-2), arranged with datetime. */
  await page.getByLabel("Next action").selectOption("meeting_setting");
  await page.getByText("Arranged?").click();
  await page.getByLabel("Date", { exact: true }).fill("2026-09-03");
  await page.getByLabel("Time", { exact: true }).fill("14:00");
  await page.getByLabel("Mode").selectOption("online");
  await page.getByRole("button", { name: "Save & move" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Meeting Setting")).toBeVisible();

  /* Meeting outcome: attended → destination Sending Proposals (T-6) with proposal group. */
  await page.getByLabel("Meeting outcome").selectOption("attended");
  await page.getByLabel("Destination").selectOption("sending_proposal");
  await page.getByLabel("Service").fill("Full brand campaign");
  await page.getByLabel("Estimated value (EGP)").fill("5000");
  await page.getByRole("button", { name: /Confirm — move to Sending Proposals/ }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Sending Proposals")).toBeVisible();

  /* Mark proposal as sent (T-5) — auto Following Up with after-proposal group. */
  await expect(page.getByText("Proposal ready — mark it as sent?")).toBeVisible();
  await page.getByLabel("Follow-up date").fill("2026-09-05");
  await page.getByLabel("Follow-up time").fill("11:30");
  await page.getByLabel("Method").selectOption("message");
  await page.getByRole("button", { name: "Sent — move to Following Up" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Following Up")).toBeVisible();
  await expect(page.getByText("Following up after proposal")).toBeVisible();

  /* Next action: Won (T-9/ADR-011) — estimated prefilled from the proposal. */
  await page.getByLabel("Next action").selectOption("won");
  await expect(page.getByLabel("Estimated value (EGP)")).toHaveValue("5000");
  await page.getByLabel("Technical owner").fill("Tarek Nabil");
  await page.getByLabel("Collected amount (EGP)").fill("2000");
  await page.getByRole("button", { name: "Save & move" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Won")).toBeVisible();

  /* Client card auto-created (A-1) with the mapped values. */
  await page.goto("/byteforce/clients");
  /* Fresh e2e DB — exactly one client card on the page. */
  await expect(page.getByText("Journey Lead Co")).toBeVisible();
  await expect(page.getByText("Full brand campaign")).toBeVisible();
  await expect(page.getByText("EGP 5,000")).toBeVisible();
  await expect(page.getByText("EGP 2,000")).toBeVisible(); // collected
  await expect(page.getByText("EGP 3,000")).toBeVisible(); // to be collected = 5000 − 2000

  /* Dashboard numbers (§6.5) — fresh DB: this is the only lead. */
  await page.goto("/byteforce");
  await expect(page.getByText("Total leads").locator("..").getByText("1", { exact: true })).toBeVisible();
  await expect(page.getByText("Won value").locator("..").getByText("EGP 5,000")).toBeVisible();
  await expect(page.getByText("To be collected").locator("..").getByText("EGP 3,000")).toBeVisible();
  await expect(page.getByText("Pipeline value").locator("..").getByText("EGP 0", { exact: true })).toBeVisible();
});

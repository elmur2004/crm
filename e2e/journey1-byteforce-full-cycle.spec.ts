import { expect, test } from "@playwright/test";

/* SPEC §13 journey 1 — ByteForce full cycle:
   add rep → add lead → Following Up → Meeting (attended → proposal) → Sent ✓ →
   auto Following Up (after proposal) → Won → Client card exists → dashboard numbers
   correct. Runs first against the freshly seeded e2e DB (absolute assertions). */

test.describe.configure({ mode: "serial" });

async function tile(page: import("@playwright/test").Page, label: string): Promise<number> {
  /* KPI values COUNT UP on load — read only once two consecutive samples agree
     (the animation has settled on the final number). */
  const read = async () => {
    const text = await page.getByText(label).locator("..").locator("p").nth(1).textContent();
    return Number((text ?? "0").replace(/[^\d.]/g, "") || "0");
  };
  let previous = await read();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(150);
    const current = await read();
    if (current === previous && current !== 0) return current;
    previous = current;
  }
  return previous;
}

test("journey 1: ByteForce full cycle to Won", async ({ page }) => {
  /* Log in as ByteForce staff. */
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("sara@byteforce.example");
  await page.getByLabel("Password").fill("byteforce123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/byteforce$/);

  /* Dashboard baseline — the seed populates every stage, so assert deltas. */
  const totalBefore = await tile(page, "Total leads");
  const pipelineBefore = await tile(page, "Pipeline value");
  const wonValueBefore = await tile(page, "Won value");
  const collectBefore = await tile(page, "To be collected");

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

  /* Dashboard numbers (§6.5) — deltas over the seeded baseline: +1 lead, won
     value +5000, to-be-collected +3000, pipeline unchanged (the lead ended Won). */
  await page.goto("/byteforce");
  expect(await tile(page, "Total leads")).toBe(totalBefore + 1);
  expect(await tile(page, "Won value")).toBe(wonValueBefore + 5000);
  expect(await tile(page, "To be collected")).toBe(collectBefore + 3000);
  expect(await tile(page, "Pipeline value")).toBe(pipelineBefore);
});

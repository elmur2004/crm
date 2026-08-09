import { expect, test, type Locator, type Page } from "@playwright/test";

/* SPEC §13 journey 4 — Portal rep cycle:
   sign up with CV → log in → create deal → drag through stages with field groups →
   attempt drag into Won is blocked → sees only own deals. Includes the API-level
   P-2 assertion (§13: "server-side rejection of a rep setting Won (API level)"). */

const PDF = Buffer.concat([Buffer.from("%PDF-1.7 journey"), Buffer.alloc(1024, 4)]);

async function dragTo(page: Page, card: Locator, column: Locator) {
  const from = (await card.boundingBox())!;
  const to = (await column.boundingBox())!;
  /* grab the card's lower edge (away from its link) and cross the pointer-sensor
     activation distance before travelling */
  await page.mouse.move(from.x + from.width / 2, from.y + from.height - 8);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height + 4, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 14 });
  await page.mouse.up();
}

test("journey 4: portal rep signs up, works the board, cannot reach Won, sees only own deals", async ({
  page,
}) => {
  /* Seeded rep Karim creates a deal first — the isolation fixture. */
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("01001234567");
  await page.getByLabel("Password").fill("partner123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/portal\/crm$/);
  await page.getByRole("button", { name: "Add deal" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Karim Secret Deal");
  await page.getByLabel("Position").fill("CEO");
  await page.getByLabel("Number", { exact: true }).fill("0107770000");
  await page.getByLabel("Company name").fill("Karim Co");
  await page.getByLabel("Industry").fill("Retail");
  await page.getByRole("button", { name: "Save deal" }).click();
  await expect(page.getByText("Karim Secret Deal")).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();

  /* Sign up with CV (§8.1). */
  await page.goto("/portal");
  await page.getByRole("link", { name: "Sign up" }).click();
  await page.getByLabel("First name").fill("Nadia");
  await page.getByLabel("Last name").fill("Sami");
  await page.getByLabel("Phone number").fill("01212121212");
  await page.getByLabel("Address").fill("3 Zamalek St, Cairo");
  await page.getByLabel("Speciality").fill("CRM consulting");
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "nadia-cv.pdf", mimeType: "application/pdf", buffer: PDF });
  await page.getByLabel("Password", { exact: true }).fill("nadia12345");
  await page.getByLabel("Confirm password").fill("nadia12345");
  await page.getByRole("button", { name: "Sign up" }).click();

  /* §8.1: on success the rep lands in their portal (auto sign-in, ADR-025). */
  await expect(page).toHaveURL(/\/portal\/crm$/);

  /* §13's explicit login step: log out, log in with the phone identifier (ADR-008). */
  await page.getByRole("button", { name: "Log out" }).click();
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("01212121212");
  await page.getByLabel("Password").fill("nadia12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/portal\/crm$/);

  /* Rep isolation: Karim's deal is invisible (§3). */
  await expect(page.getByText("Karim Secret Deal")).toHaveCount(0);

  /* Create a deal (§8.2 fields). */
  await page.getByRole("button", { name: "Add deal" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Nadia Prospect");
  await page.getByLabel("Position").fill("Operations Lead");
  await page.getByLabel("Number", { exact: true }).fill("0108880000");
  await page.getByLabel("Company name").fill("Prospect GmbH");
  await page.getByLabel("Industry").fill("Manufacturing");
  await page.getByRole("button", { name: "Save deal" }).click();
  const card = page.locator('[data-deal-card="Nadia Prospect"]');
  await expect(card).toBeVisible();

  /* P-1: drag Leads → Following Up; the stage's field group opens; confirm commits. */
  await dragTo(page, card, page.locator('[data-stage="following_up"]'));
  await expect(page.getByText("Complete this stage's details to confirm the move")).toBeVisible();
  await page.getByLabel("Follow-up date").fill("2026-10-01");
  await page.getByLabel("Follow-up time").fill("10:00");
  await page.getByLabel("Method").selectOption("call");
  await page.getByRole("button", { name: "Confirm move" }).click();
  await expect(
    page.locator('[data-stage="following_up"]').getByText("Nadia Prospect"),
  ).toBeVisible();

  /* Cancel reverts: drag to Proposal Sending, cancel the form, card stays put. */
  await dragTo(page, card, page.locator('[data-stage="proposal_sending"]'));
  await expect(page.getByText("Complete this stage's details to confirm the move")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(
    page.locator('[data-stage="following_up"]').getByText("Nadia Prospect"),
  ).toBeVisible();

  /* P-2 (UI): drag into Won is blocked with the clear message. */
  await dragTo(page, card, page.locator('[data-stage="won"]'));
  await expect(page.getByText("Only the portal admin can move a deal to Won.")).toBeVisible();
  await expect(page.locator('[data-stage="won"]').getByText("Nadia Prospect")).toHaveCount(0);

  /* P-2 (API level, §13): the raw endpoint rejects a rep's Won attempt with 403. */
  const dealHref = await page
    .locator('[data-stage="following_up"]')
    .getByRole("link", { name: "Nadia Prospect" })
    .getAttribute("href");
  const dealId = dealHref!.split("/").pop()!;
  const apiResponse = await page.request.post(`/api/portal/deals/${dealId}/event`, {
    data: { event: { type: "drag", to: "won" } },
  });
  expect(apiResponse.status()).toBe(403);
  const body = (await apiResponse.json()) as { error: string };
  expect(body.error).toContain("admin");

  /* The deal detail shows the accumulated group history. */
  await page.locator('[data-stage="following_up"]').getByRole("link", { name: "Nadia Prospect" }).click();
  await expect(page.getByText("Following up", { exact: true })).toBeVisible();
  await expect(page.getByText("[P-1]")).toBeVisible();
});

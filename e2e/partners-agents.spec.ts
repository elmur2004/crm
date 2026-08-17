import { expect, test } from "@playwright/test";

/* Founder: "I want the CRM of the partners to be the CRM of the partners and
   agents... and once I put them Won, I have to create for them a user and a
   password — they will not apply, I will create for them a user and a password."

   Journey 3 covers the PARTNER card. This is its sibling for the AGENT card on
   the same board: created with the public signup form's fields (CV included),
   run through the SAME pipeline, and Won through the gate that mints the
   account — after which the agent signs in with the admin-set credentials and
   lands on their own CRM, never having touched Registrations. */

const PDF = Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(4096, 7)]);

test("an agent card runs the shared pipeline and its Won gate creates a working login", async ({
  page,
  browser,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("admin@byteforce.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/b-systems$/);

  /* The one entry point asks WHICH kind first, then swaps the field set to the
     agent's — the same fields the applicant fills in on the public form. But
     only the NAME and the NUMBER are required here (founder: the admin is
     usually mid-phone-call), so this card is saved with nothing else but a CV. */
  await page.goto("/b-systems/partners-pipeline");
  await page.getByRole("button", { name: "Add partner or agent" }).click();
  await page.getByLabel("What are you adding?").selectOption("agent");
  await page.getByLabel("First name").fill("Mostafa");
  await page.getByLabel("Last name").fill("Kamel");
  await page.getByLabel("Phone number").fill("01044556677");
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "mostafa-cv.pdf", mimeType: "application/pdf", buffer: PDF });
  await page.getByRole("button", { name: "Save card" }).click();

  /* It is a card on the SAME board, told apart by its kind chip. */
  const card = page.locator('[data-deal-card="Mostafa Kamel"]');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("data-kind", "agent");
  await expect(card.getByText("Agent")).toBeVisible();

  /* The shared pipeline: the agent card follows up exactly like a partner. */
  await page.getByRole("link", { name: "Mostafa Kamel" }).click();
  await expect(page.getByText("mostafa-cv.pdf")).toBeVisible(); // the CV rode along
  await page.getByLabel("Next action").selectOption("following_up");
  await page.getByLabel("Follow-up date").fill("2026-09-18");
  await page.getByLabel("Follow-up time").fill("11:00");
  await page.getByLabel("Method").selectOption("call");
  await page.getByRole("button", { name: "Save & move" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Following Up")).toBeVisible();

  /* The Won gate is where the strictness lives: what the card has is prefilled,
     what it lacks must be typed, and the credentials are the ADMIN's to set. */
  await page.getByLabel("Next action").selectOption("won");
  await expect(page.getByText("Won creates the agent's account")).toBeVisible();
  const gate = page.locator("form").filter({ hasText: "Won creates the agent's account" });
  await expect(gate.getByLabel("First name")).toHaveValue("Mostafa");
  await expect(gate.getByLabel("Phone number")).toHaveValue("01044556677");
  await expect(gate.getByLabel("Speciality")).toHaveValue(""); // never asked on the card
  await gate.getByLabel("Address").fill("31 El Merghany, Heliopolis");
  await gate.getByLabel("Speciality").fill("Manufacturing ERP");
  await gate.getByLabel("Email").fill("mostafa.kamel@example.com");
  await gate.getByLabel("Password").fill("agentpass123");
  await page.getByRole("button", { name: "Save & move" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Won")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Converted")).toBeVisible();
  await expect(page.getByText(/Agent account created/)).toBeVisible();

  /* They are an AGENT: in the Agents section, never in the Partners directory. */
  await page.goto("/b-systems/agents");
  await expect(page.getByText("Mostafa Kamel")).toBeVisible();
  await page.goto("/b-systems/partners");
  await expect(page.getByText("Mostafa Kamel")).toHaveCount(0);

  /* And they never queued in Registrations — the admin created the account, so
     the approval section knows nothing about them (they are only in the full
     "Everyone on the system" list, like every admin-created account). */
  await page.goto("/b-systems/registrations");
  const awaiting = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Awaiting approval" }) });
  await expect(awaiting.getByText("Mostafa Kamel")).toHaveCount(0);

  /* The promise the founder made: they sign in with the credentials the admin
     set, straight away, and land on their own CRM. */
  const agentCtx = await browser.newContext();
  const agentPage = await agentCtx.newPage();
  await agentPage.goto("/login");
  await agentPage.getByLabel("Email or phone").fill("mostafa.kamel@example.com");
  await agentPage.getByLabel("Password").fill("agentpass123");
  await agentPage.getByRole("button", { name: "Sign in" }).click();
  await expect(agentPage).toHaveURL(/\/b-systems\/crm$/);
  await agentCtx.close();
});

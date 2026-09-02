import { expect, test, type Locator, type Page } from "@playwright/test";

/* ADR-073 — take the id from the PATHNAME, not the raw href. Card links carry
   `?company=` now that the lead detail is shared between companies, and a bare
   `split("/").pop()` returns "<id>?company=bsystems" — which then swallows the
   rest of every URL built from it (`/leads/<id>?company=bsystems/event` is a
   POST to the COLLECTION route, answering 405 where the test expected 403). */
const idFromHref = (href: string) => new URL(href, "http://x").pathname.split("/").pop()!;

/* V2 journey 4 — Agent cycle on the UNIFIED B-Systems board (the portal is gone):
   sign up with CV → land on /b-systems/crm → sees only own leads → add a lead →
   drag through stages with the LIGHT forms (day-only follow-up, no owner/with) →
   Won is blocked in UI and at the API → meeting request shows the WhatsApp
   confirmation → mark ready to close flags the card. */

const PDF = Buffer.concat([Buffer.from("%PDF-1.7 journey"), Buffer.alloc(1024, 4)]);

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
  /* grab the card's middle-right edge — clear of the top-left link AND the
     bottom "Mark ready to close" button (both stop pointer propagation) — and
     cross the pointer-sensor activation distance before travelling */
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

test("journey 4: agent requests to join, admin approves, agent works the board with email OR phone", async ({
  page,
  browser,
}) => {
  /* Sign up with CV — founder V3: BOTH identifiers, and it's an approval REQUEST. */
  await page.goto("/portal");
  await page.getByRole("link", { name: "Sign up" }).click();
  await page.getByLabel("First name").fill("Nadia");
  await page.getByLabel("Last name").fill("Sami");
  await page.getByLabel("Phone number").fill("01212121212");
  await page.getByLabel("Email").fill("nadia@agents.example");
  await page.getByLabel("Address").fill("3 Zamalek St, Cairo");
  await page.getByLabel("Speciality").fill("CRM consulting");
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "nadia-cv.pdf", mimeType: "application/pdf", buffer: PDF });
  await page.getByLabel("Password", { exact: true }).fill("nadia12345");
  await page.getByLabel("Confirm password").fill("nadia12345");
  await page.getByRole("button", { name: "Sign up" }).click();

  /* The request is acknowledged — no auto sign-in any more. */
  await expect(
    page.getByText("Request received — the admin reviews new registrations", { exact: false }),
  ).toBeVisible();

  /* Signing in while pending is refused with the clear message. */
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("01212121212");
  await page.getByLabel("Password").fill("nadia12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Your registration is awaiting approval", { exact: false })).toBeVisible();

  /* The admin approves the request on Registrations. */
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await adminPage.goto("/login");
  await adminPage.getByLabel("Email or phone").fill("admin@byteforce.com");
  await adminPage.getByLabel("Password").fill("password123");
  await adminPage.getByRole("button", { name: "Sign in" }).click();
  await adminPage.waitForURL(/\/b-systems$/);
  await adminPage.goto("/b-systems/registrations");
  const requestRow = adminPage.getByRole("row", { name: /Nadia Sami/ }).first();
  await expect(requestRow.getByText("nadia@agents.example")).toBeVisible();
  await requestRow.getByRole("button", { name: "Approve" }).click();
  await expect(
    adminPage.getByText("No pending requests — new sign-ups land here for review."),
  ).toBeVisible();
  await adminCtx.close();

  /* founder: email AND phone both sign in. First the EMAIL… */
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("nadia@agents.example");
  await page.getByLabel("Password").fill("nadia12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/b-systems\/crm$/);

  /* …then the phone (ADR-008/028 round-trip). */
  await page.getByRole("button", { name: "Log out" }).click();
  await page.goto("/login");
  await page.getByLabel("Email or phone").fill("01212121212");
  await page.getByLabel("Password").fill("nadia12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/b-systems\/crm$/);

  /* Agent isolation: the seeded agent Karim's leads are invisible (§3). */
  await expect(page.getByText("Fresh Deal")).toHaveCount(0);
  await expect(page.getByText("Follow-up Deal")).toHaveCount(0);

  /* Create a lead (V2 §1 fields — the ex-portal deal shape). */
  await page.getByRole("button", { name: "Add lead" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Nadia Prospect");
  await page.getByLabel("Number", { exact: true }).fill("0108880000");
  await page.getByLabel("Position").fill("Operations Lead");
  await page.getByLabel("Company name").fill("Prospect GmbH");
  await page.getByLabel("Industry").fill("Manufacturing");
  await page.getByRole("button", { name: "Save lead" }).click();
  const card = page.locator('[data-deal-card="Nadia Prospect"]');
  await expect(card).toBeVisible();

  /* Drag New → Following Up; the LIGHT form opens: a required day, an OPTIONAL
     time (ADR-063 — the field came back for every role), still no Owner. */
  await dragTo(page, card, page.locator('[data-stage="following_up"]'));
  await expect(page.getByText("Complete this stage's details to confirm the move")).toBeVisible();
  await expect(page.getByLabel("Follow-up date")).toBeVisible();
  await expect(page.getByLabel("Follow-up time (optional)")).toBeVisible();
  await expect(page.getByLabel("Owner")).toHaveCount(0);
  await page.getByLabel("Follow-up date").fill("2026-10-01");
  await page.getByLabel("Method").selectOption("call");
  await page.getByRole("button", { name: "Confirm move" }).click();
  await expect(
    page.locator('[data-stage="following_up"]').getByText("Nadia Prospect"),
  ).toBeVisible();

  /* Cancel reverts: drag to Sending Proposal, cancel the form, card stays put. */
  await dragTo(page, card, page.locator('[data-stage="sending_proposal"]'));
  await expect(page.getByText("Complete this stage's details to confirm the move")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(
    page.locator('[data-stage="following_up"]').getByText("Nadia Prospect"),
  ).toBeVisible();

  /* Won is blocked in the UI with a clear message. */
  await dragTo(page, card, page.locator('[data-stage="won"]'));
  await expect(page.getByText("Only an admin can confirm a win.")).toBeVisible();
  await expect(page.locator('[data-stage="won"]').getByText("Nadia Prospect")).toHaveCount(0);

  /* …and at the API (server-side, §3/V2 §11). */
  const dealHref = await page
    .locator('[data-stage="following_up"]')
    .getByRole("link", { name: "Nadia Prospect" })
    .getAttribute("href");
  const leadId = idFromHref(dealHref!);
  const apiResponse = await page.request.post(`/api/b-systems/leads/${leadId}/event`, {
    data: { event: { type: "drag", to: "won" } },
  });
  expect(apiResponse.status()).toBe(403);

  /* Lead detail: the meeting Q&A flow ends in the WhatsApp confirmation (V2 §3). */
  await page.goto(`/b-systems/crm/lead/${leadId}`);
  await page.getByLabel("Next action").selectOption("meeting_setting");
  await expect(page.getByText("Did you agree with the client on a time?")).toBeVisible();
  await page.getByLabel("Date", { exact: true }).fill("2026-10-05");
  await page.getByLabel("Time", { exact: true }).fill("14:00");
  await page.getByLabel("Mode").selectOption("online");
  await page.getByText("Do you need a technical colleague with you?").click();
  await page.getByRole("button", { name: "Save & move" }).click();
  await expect(
    page.getByText("Your request was received — we'll confirm on WhatsApp."),
  ).toBeVisible();

  /* Mark ready to close — always available, flags the card (V2 §3). */
  await page.getByRole("button", { name: "Mark ready to close" }).click();
  await expect(page.getByText("Ready to close").first()).toBeVisible();
});
